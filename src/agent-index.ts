/**
 * Agent Evaluation Entry Point
 *
 * Runs evaluations using supported CLI agents.
 * instead of API-based model calls.
 *
 * Usage:
 *   bun src/agent-index.ts --agent claude-code
 *   bun src/agent-index.ts --agent claude-code --mcp
 *   bun src/agent-index.ts --agent claude-code --mcp --eval auth/protect --debug
 */

import { execSync } from 'node:child_process'
import path from 'node:path'
import { parseArgs } from 'node:util'
import Tinypool from 'tinypool'
import { classifyFailure } from '@/src/classifiers/failure'
import { EVALUATIONS } from '@/src/config'
import { getResults, initDB, saveError, saveResult, saveRun } from '@/src/db'
import { getEvalKey, getGitCommit, getSuiteHash } from '@/src/eval-identity'
import type { AgentRunnerArgs, AgentType, RunnerResult, Score } from '@/src/interfaces'
import { AGENTS, getAgentInfo, getAllAgentTypes } from '@/src/interfaces/agent'
import { summarizeTrials, type TrialResult } from '@/src/metrics/pass-at-k'
import consoleReporter from '@/src/reporters/console'
import fileReporter from '@/src/reporters/file'
import { formatError } from '@/src/utils/error'

/**
 * Resolve the path to an agent CLI executable.
 * Run this in the main process where PATH is available.
 */
function resolveAgentPath(agentType: AgentType): string | undefined {
  const agentInfo = AGENTS[agentType]
  if (!agentInfo) return undefined

  try {
    const result = execSync(`which ${agentInfo.command}`, { encoding: 'utf8' })
    return result.trim()
  } catch {
    return undefined
  }
}

const DEFAULT_MCP_URL = 'https://mcp.clerk.dev/mcp'

// CLI argument parsing using util.parseArgs
const { values } = parseArgs({
  args: Bun.argv,
  options: {
    agent: { type: 'string', short: 'a' },
    mcp: { type: 'boolean', default: false },
    skills: { type: 'boolean', default: false },
    'skills-path': { type: 'string' },
    debug: { type: 'boolean', short: 'd', default: false },
    eval: { type: 'string', short: 'e' },
    timeout: { type: 'string', short: 't' },
    runs: { type: 'string', short: 'r' },
    model: { type: 'string', short: 'm' },
  },
  strict: true,
  allowPositionals: true,
})

const agentArg = values.agent
const mcpEnabled = values.mcp
const skillsEnabled = values.skills
const skillsPath = values['skills-path'] || path.join(process.cwd(), '..', 'skills', 'skills')
const debugEnabled = values.debug
const evalFilter = values.eval
const timeoutArg = values.timeout
const runsCount = values.runs ? Number.parseInt(values.runs, 10) : 1
const model =
  values.model ??
  (agentArg === 'claude-code' ? process.env.ANTHROPIC_MODEL : process.env.OPENAI_MODEL)

const normalizeEvalPath = (value: string) => {
  if (value.startsWith('./')) return normalizeEvalPath(value.slice(2))
  if (value.startsWith('evals/')) return value
  return `evals/${value}`
}

// Validate agent
if (!agentArg) {
  console.error('Error: --agent flag is required')
  console.error(`Available agents: ${getAllAgentTypes().join(', ')}`)
  process.exit(1)
}

const agentType = agentArg as AgentType
if (!AGENTS[agentType]) {
  console.error(`Error: Unknown agent "${agentArg}"`)
  console.error(`Available agents: ${getAllAgentTypes().join(', ')}`)
  process.exit(1)
}

const agentInfo = getAgentInfo(agentType)

if (!model) {
  const envName = agentType === 'claude-code' ? 'ANTHROPIC_MODEL' : 'OPENAI_MODEL'
  console.error(`Error: --model or ${envName} is required for reproducible agent runs`)
  process.exit(1)
}

// Resolve executable path in main process (where PATH is available)
const executablePath = resolveAgentPath(agentType)
if (!executablePath) {
  console.error(`Error: Could not find "${agentInfo.command}" in PATH`)
  console.error(`Make sure ${agentInfo.label} CLI is installed`)
  process.exit(1)
}
console.log(`Using ${agentInfo.label} at: ${executablePath}`)

// Setup
initDB()
const evaluations = EVALUATIONS.filter((evaluation) => evaluation.agentEligible)

// Filter evaluations
const filteredEvaluations = (() => {
  if (!evalFilter) return evaluations

  const normalized = normalizeEvalPath(evalFilter)
  const matches = evaluations.filter(
    (e) =>
      e.path === normalized ||
      e.path.endsWith(`/${normalized}`) ||
      e.path.endsWith(`/${evalFilter}`) ||
      e.category.toLowerCase().includes(evalFilter.toLowerCase()) ||
      e.path.toLowerCase().includes(evalFilter.toLowerCase()),
  )

  if (matches.length === 0) {
    console.error(
      `No evaluation matching "${evalFilter}". Available: ${evaluations.map((e) => e.path).join(', ')}`,
    )
    process.exit(1)
  }

  return matches
})()

// Create pool with agent runner
// Note: Using fewer workers for CLI agents due to overhead
const runnerPath = `./runners/agents/${agentType}.ts`
const pool = new Tinypool({
  runtime: 'child_process',
  filename: new URL(runnerPath, import.meta.url).href,
  isolateWorkers: true,
  idleTimeout: 60000, // Longer idle timeout for CLI agents
  maxThreads: 4, // Fewer workers - CLI agents are heavier
})

const mcpUrl = process.env.MCP_SERVER_URL_OVERRIDE || DEFAULT_MCP_URL
const runIdSuffix = [skillsEnabled ? 'skills' : '', mcpEnabled ? 'mcp' : '']
  .filter(Boolean)
  .join('-')
const runId = `agent-${agentType}${runIdSuffix ? `-${runIdSuffix}` : ''}-${new Date().toISOString().replace(/[:.]/g, '-')}`
const suiteHash = await getSuiteHash(filteredEvaluations)
const harnessCommit = getGitCommit()
const skillsCommit = skillsEnabled ? getGitCommit(skillsPath) : undefined

// Build tasks
const tasks = filteredEvaluations.map((evaluation) => ({
  agent: agentType,
  category: evaluation.category,
  framework: evaluation.framework,
  evalPath: path.join(process.cwd(), 'src', evaluation.path),
  evaluationPath: evaluation.path,
  evalKey: getEvalKey(evaluation),
  variant: evaluation.variant,
  fixturesPath: evaluation.variant
    ? path.join(process.cwd(), 'src', evaluation.path, 'fixtures', evaluation.variant)
    : undefined,
  gradersPath: evaluation.variant
    ? path.join(process.cwd(), 'src', evaluation.path, 'graders', `${evaluation.variant}.ts`)
    : undefined,
}))

// Progress output
const modeLabels: string[] = [agentInfo.label]
if (skillsEnabled) modeLabels.push('Skills')
if (mcpEnabled) modeLabels.push('MCP')
const mode = `Agent (${modeLabels.join(' + ')})`
console.log(`\nMode: ${mode}`)
if (skillsEnabled) {
  console.log(`Skills Path: ${skillsPath}`)
}
if (mcpEnabled) {
  console.log(`MCP Server: ${mcpUrl}`)
}
if (runsCount > 1) {
  console.log(`Runs per eval: ${runsCount}`)
}
console.log(
  `Running ${tasks.length} evaluations${runsCount > 1 ? ` (${tasks.length * runsCount} total runs)` : ''}\n`,
)

saveRun({
  runId,
  mode: `agent-${agentType}${runIdSuffix ? `-${runIdSuffix}` : ''}`,
  models: [`${agentType}:${model}`],
  evalKeys: tasks.map((task) => task.evalKey),
  suiteHash,
  harnessCommit,
  skillsCommit,
  mcpServerUrl: mcpEnabled ? mcpUrl : undefined,
})

let completed = 0
const totalRuns = tasks.length * runsCount

// Run all in parallel (with limited concurrency)
await Promise.all(
  tasks.map(async (task) => {
    const trialResults: TrialResult[] = []

    for (let trial = 1; trial <= runsCount; trial++) {
      const trialLabel = runsCount > 1 ? ` [trial ${trial}/${runsCount}]` : ''
      console.log(`[start] ${task.agent} -> ${task.evaluationPath}${trialLabel}`)

      const runnerArgs: AgentRunnerArgs = {
        agent: task.agent,
        evalPath: task.evalPath,
        debug: debugEnabled,
        mcpConfig: mcpEnabled
          ? {
              enabled: true,
              serverUrl: mcpUrl,
            }
          : undefined,
        skillsConfig: skillsEnabled
          ? {
              enabled: true,
              sourcePath: skillsPath,
              evalPath: task.evaluationPath,
            }
          : undefined,
        timeout: timeoutArg ? Number.parseInt(timeoutArg, 10) : undefined,
        executablePath,
        envPath: process.env.PATH,
        model,
        fixturesPath: task.fixturesPath,
        gradersPath: task.gradersPath,
      }

      const startTime = Date.now()

      try {
        const result: RunnerResult = await pool.run(runnerArgs)

        if (!result.ok) {
          const errorMsg = formatError(result.error)
          console.error(`[error] ${task.agent}${trialLabel}: ${errorMsg}`)

          // Classify the failure
          const failureType = classifyFailure(
            {
              success: false,
              output: '',
              duration: Date.now() - startTime,
              exitCode: -1,
              error: errorMsg,
            },
            timeoutArg ? Number.parseInt(timeoutArg, 10) : 600_000,
          )

          const errorLabelParts: string[] = [agentInfo.label]
          if (skillsEnabled) errorLabelParts.push('Skills')
          if (mcpEnabled) errorLabelParts.push('MCP')
          saveError(runId, {
            model: `${task.agent}:${model}`,
            label: `${errorLabelParts.join(' + ')} (${model})`,
            framework: task.framework,
            category: task.category,
            evaluationPath: task.evaluationPath,
            error: result.error,
            trial,
            failureType,
          })

          trialResults.push({
            trial,
            score: 0,
            durationMs: Date.now() - startTime,
            success: false,
          })
          continue
        }

        const labelParts: string[] = [agentInfo.label]
        if (skillsEnabled) labelParts.push('Skills')
        if (mcpEnabled) labelParts.push('MCP')
        const score: Score = {
          model: `${task.agent}:${model}`,
          label: `${labelParts.join(' + ')} (${model})`,
          framework: task.framework,
          category: task.category,
          value: result.value.score,
          updatedAt: new Date().toISOString(),
          durationMs: result.value.durationMs,
          evalKey: task.evalKey,
          trial,
        }
        saveResult(runId, score, task.evaluationPath, task.evalKey)

        trialResults.push({
          trial,
          score: result.value.score,
          durationMs: result.value.durationMs ?? Date.now() - startTime,
          success: result.value.score === 1,
        })
      } finally {
        completed++
        console.log(
          `[done ${completed}/${totalRuns}] ${task.agent} -> ${task.evaluationPath}${trialLabel}`,
        )
      }
    }

    // Log multi-trial summary
    if (runsCount > 1 && trialResults.length > 0) {
      const summary = summarizeTrials(trialResults)
      console.log(
        `[summary] ${task.evaluationPath}: ${summary.passed}/${summary.totalTrials} passed, ` +
          `pass@1=${(summary.passAt1 * 100).toFixed(0)}%, ` +
          `pass@${runsCount}=${(summary.passAtK * 100).toFixed(0)}%, ` +
          `mean=${(summary.meanScore * 100).toFixed(0)}%`,
      )
    }
  }),
)

// Report
const outputFile = 'agent-scores.json'
const dbScores = getResults(runId)
fileReporter(dbScores, outputFile)

if (debugEnabled) {
  consoleReporter(dbScores)
} else {
  console.log(`Scores written to: ${outputFile}`)
}

await pool.destroy()
