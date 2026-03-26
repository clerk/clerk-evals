/**
 * Agent Evaluation Entry Point
 *
 * Runs evaluations using CLI agents (Claude Code, Cursor, etc.)
 * instead of API-based model calls.
 *
 * Usage:
 *   bun src/agent-index.ts --agent claude-code
 *   bun src/agent-index.ts --agent claude-code --mcp
 *   bun src/agent-index.ts --agent claude-code --mcp --eval auth/protect --debug
 */

import { execSync } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { parseArgs } from 'node:util'
import Tinypool from 'tinypool'
import { classifyFailure } from '@/src/classifiers/failure'
import { EVALUATIONS } from '@/src/config'
import { getResults, initDB, saveError, saveResult } from '@/src/db'
import type {
  AgentRunnerArgs,
  AgentType,
  RunnerDebugPayload,
  RunnerResult,
  Score,
} from '@/src/interfaces'
import { AGENTS, getAgentInfo, getAllAgentTypes } from '@/src/interfaces/agent'
import { summarizeTrials, type TrialResult } from '@/src/metrics/pass-at-k'
import consoleReporter from '@/src/reporters/console'
import fileReporter from '@/src/reporters/file'

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
const evaluations = EVALUATIONS

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

type DebugArtifact = {
  agent: string
  framework: string
  category: string
  evaluationPath: string
  score: number
  prompt: string
  response: string
  graders: RunnerDebugPayload['graders']
  transcript?: string
}

const debugArtifacts: DebugArtifact[] = []

let debugRunDirectory: string | undefined
if (debugEnabled) {
  debugRunDirectory = path.join(process.cwd(), 'debug-runs', runId)
  await mkdir(debugRunDirectory, { recursive: true })
  console.log(`Debug mode enabled. Saving outputs to ${debugRunDirectory}`)
}

// Build tasks
const tasks = filteredEvaluations.map((evaluation) => ({
  agent: agentType,
  category: evaluation.category,
  framework: evaluation.framework,
  evalPath: path.join(process.cwd(), 'src', evaluation.path),
  evaluationPath: evaluation.path,
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
        fixturesPath: task.fixturesPath,
        gradersPath: task.gradersPath,
      }

      const startTime = Date.now()

      try {
        const result: RunnerResult = await pool.run(runnerArgs)

        if (!result.ok) {
          const errorMsg =
            result.error instanceof Error
              ? result.error.message
              : typeof result.error === 'object'
                ? JSON.stringify(result.error)
                : String(result.error)
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
            model: task.agent,
            label: errorLabelParts.join(' + '),
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
          model: task.agent,
          label: labelParts.join(' + '),
          framework: task.framework,
          category: task.category,
          value: result.value.score,
          updatedAt: new Date().toISOString(),
          durationMs: result.value.durationMs,
        }
        saveResult(runId, score, task.evaluationPath)

        trialResults.push({
          trial,
          score: result.value.score,
          durationMs: result.value.durationMs ?? Date.now() - startTime,
          success: result.value.score >= 0.5,
        })

        if (debugEnabled && result.value.debug && debugRunDirectory) {
          const artifact: DebugArtifact = {
            agent: task.agent,
            framework: task.framework,
            category: task.category,
            evaluationPath: task.evaluationPath,
            score: result.value.score,
            prompt: result.value.debug.prompt,
            response: result.value.debug.response,
            graders: result.value.debug.graders,
            transcript: result.value.debug.transcript,
          }
          debugArtifacts.push(artifact)

          // Write debug files
          const evalSlug = task.variant
            ? `${task.evaluationPath.replace(/\//g, '__')}__${task.variant}`
            : task.evaluationPath.replace(/\//g, '__')
          const trialSuffix = runsCount > 1 ? `__trial${trial}` : ''
          const debugPath = path.join(
            debugRunDirectory,
            `${evalSlug}__${task.agent}${trialSuffix}.json`,
          )
          await writeFile(debugPath, JSON.stringify(result.value.debug, null, 2))

          if (result.value.debug.transcript) {
            const transcriptPath = path.join(
              debugRunDirectory,
              `${evalSlug}__${task.agent}${trialSuffix}.md`,
            )
            await writeFile(transcriptPath, result.value.debug.transcript)
          }
        }
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
