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
import Tinypool from 'tinypool'
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

// CLI argument parsing
const args = process.argv.slice(2)

const parseBooleanFlag = (name: string, alias?: string) => {
  const equalsArg = args.find((arg) => arg.startsWith(`--${name}=`))
  if (equalsArg) {
    const [, rawValue] = equalsArg.split('=', 2)
    const value = rawValue?.toLowerCase()
    return !['false', '0', 'no'].includes(value ?? '')
  }

  const index = args.findIndex((arg) => arg === `--${name}` || (alias && arg === alias))
  if (index === -1) return false

  const value = args[index + 1]
  if (value && !value.startsWith('-')) {
    return !['false', '0', 'no'].includes(value.toLowerCase())
  }
  return true
}

const parseStringArg = (name: string, alias?: string): string | undefined => {
  const equalsArg = args.find((arg) => arg.startsWith(`--${name}=`))
  if (equalsArg) return equalsArg.split('=', 2)[1]

  const index = args.findIndex((arg) => arg === `--${name}` || (alias && arg === alias))
  if (index !== -1 && args[index + 1] && !args[index + 1].startsWith('-')) {
    return args[index + 1]
  }
  return undefined
}

const normalizeEvalPath = (value: string) => {
  if (value.startsWith('./')) return normalizeEvalPath(value.slice(2))
  if (value.startsWith('evals/')) return value
  return `evals/${value}`
}

// Parse flags
const agentArg = parseStringArg('agent', '-a')
const mcpEnabled = parseBooleanFlag('mcp')
const debugEnabled = parseBooleanFlag('debug', '-d')
const evalFilter = parseStringArg('eval', '-e')
const timeoutArg = parseStringArg('timeout', '-t')

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
const runId = `agent-${agentType}${mcpEnabled ? '-mcp' : ''}-${new Date().toISOString().replace(/[:.]/g, '-')}`

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
}))

// Progress output
const mode = mcpEnabled ? `Agent (${agentInfo.label} + MCP)` : `Agent (${agentInfo.label})`
console.log(`\nMode: ${mode}`)
if (mcpEnabled) {
  console.log(`MCP Server: ${mcpUrl}`)
}
console.log(`Running ${tasks.length} evaluations\n`)

let completed = 0

// Run all in parallel (with limited concurrency)
await Promise.all(
  tasks.map(async (task) => {
    console.log(`[start] ${task.agent} -> ${task.evaluationPath}`)

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
      timeout: timeoutArg ? Number.parseInt(timeoutArg, 10) : undefined,
      executablePath,
      envPath: process.env.PATH,
    }

    try {
      const result: RunnerResult = await pool.run(runnerArgs)

      if (!result.ok) {
        const errorMsg =
          result.error instanceof Error
            ? result.error.message
            : typeof result.error === 'object'
              ? JSON.stringify(result.error)
              : String(result.error)
        console.error(`[error] ${task.agent}: ${errorMsg}`)
        saveError(runId, {
          model: task.agent,
          label: mcpEnabled ? `${agentInfo.label} (MCP)` : agentInfo.label,
          framework: task.framework,
          category: task.category,
          evaluationPath: task.evaluationPath,
          error: result.error,
        })
        return
      }

      const score: Score = {
        model: task.agent,
        label: mcpEnabled ? `${agentInfo.label} (MCP)` : agentInfo.label,
        framework: task.framework,
        category: task.category,
        value: result.value.score,
        updatedAt: new Date().toISOString(),
      }
      saveResult(runId, score)

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
        const debugPath = path.join(
          debugRunDirectory,
          `${task.evaluationPath.replace(/\//g, '__')}__${task.agent}.json`,
        )
        await writeFile(debugPath, JSON.stringify(result.value.debug, null, 2))

        if (result.value.debug.transcript) {
          const transcriptPath = path.join(
            debugRunDirectory,
            `${task.evaluationPath.replace(/\//g, '__')}__${task.agent}.md`,
          )
          await writeFile(transcriptPath, result.value.debug.transcript)
        }
      }
    } finally {
      completed++
      console.log(`[done ${completed}/${tasks.length}] ${task.agent} -> ${task.evaluationPath}`)
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
