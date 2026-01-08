import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import Tinypool from 'tinypool'

import { getResults, initDB, saveError, saveResult } from '@/src/db'
import type { Evaluation, MCPRunnerArgs, RunnerResult, Score } from '@/src/interfaces'
import type { ModelInfo, Provider } from '@/src/providers'
import consoleReporter from '@/src/reporters/console'
import fileReporter from '@/src/reporters/file'

const DEFAULT_MCP_URL = 'https://mcp.clerk.dev/mcp'

// Create pool for MCP runner
const mcpPool = new Tinypool({
  runtime: 'child_process',
  filename: new URL('../runners/mcp.ts', import.meta.url).href,
  isolateWorkers: true,
  idleTimeout: 30000,
  maxThreads: 8,
})

initDB()

/**
 * Models to test with MCP
 */
const models: ModelInfo[] = [
  { provider: 'openai', name: 'gpt-4o', label: 'GPT-4o' },
  { provider: 'openai', name: 'gpt-5', label: 'GPT-5' },
  { provider: 'openai', name: 'gpt-5-chat-latest', label: 'GPT-5 Chat' },
  { provider: 'anthropic', name: 'claude-sonnet-4-0', label: 'Claude Sonnet 4' },
  { provider: 'anthropic', name: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5' },
  { provider: 'anthropic', name: 'claude-opus-4-0', label: 'Claude Opus 4' },
  { provider: 'anthropic', name: 'claude-opus-4-5', label: 'Claude Opus 4.5' },
  { provider: 'anthropic', name: 'claude-haiku-4-5', label: 'Claude Haiku 4.5' },
  { provider: 'vercel', name: 'v0-1.5-md', label: 'v0-1.5-md' },
  { provider: 'google', name: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { provider: 'google', name: 'gemini-3-pro-preview', label: 'Gemini 3 Pro Preview' },
]

/**
 * Evaluations (same as main runner, aligned with Mitch's restructure)
 */
const evaluations: Evaluation[] = [
  // Auth vertical
  { framework: 'Next.js', category: 'Auth', path: 'evals/auth/protect' },
  { framework: 'Next.js', category: 'Auth', path: 'evals/auth/routes' },
  { framework: 'Next.js', category: 'Auth', path: 'evals/auth/users' },
  // Billing vertical
  { framework: 'Next.js', category: 'Billing', path: 'evals/billing/checkout-new' },
  { framework: 'Next.js', category: 'Billing', path: 'evals/billing/checkout-existing' },
  // Organizations vertical
  { framework: 'Next.js', category: 'Organizations', path: 'evals/organizations/url-sync' },
  // Webhooks
  { framework: 'Next.js', category: 'Webhooks', path: 'evals/webhooks/auth/receive' },
  { framework: 'Next.js', category: 'Webhooks', path: 'evals/webhooks/auth/sync' },
  { framework: 'Next.js', category: 'Webhooks', path: 'evals/webhooks/billing/events' },
  { framework: 'Next.js', category: 'Webhooks', path: 'evals/webhooks/billing/subscriptions' },
  { framework: 'Next.js', category: 'Webhooks', path: 'evals/webhooks/organizations/membership' },
  { framework: 'Next.js', category: 'Webhooks', path: 'evals/webhooks/notifications' },
]

// Parse CLI arguments
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

const parseStringArg = (name: string): string | undefined => {
  const equalsArg = args.find((arg) => arg.startsWith(`--${name}=`))
  if (equalsArg) return equalsArg.split('=')[1]
  const index = args.indexOf(`--${name}`)
  if (index !== -1 && args[index + 1] && !args[index + 1].startsWith('-')) {
    return args[index + 1]
  }
  return undefined
}

const debugEnabled = parseBooleanFlag('debug', '-d')
const modelFilter = parseStringArg('model')
const evalFilter = parseStringArg('eval')

const filteredModels = modelFilter
  ? models.filter((m) => m.label.toLowerCase().includes(modelFilter.toLowerCase()))
  : models

const filteredEvals = evalFilter
  ? evaluations.filter(
      (e) =>
        e.category.toLowerCase().includes(evalFilter.toLowerCase()) ||
        e.path.toLowerCase().includes(evalFilter.toLowerCase()),
    )
  : evaluations

async function main() {
  if (filteredModels.length === 0) {
    console.error(`No models match filter: "${modelFilter}"`)
    process.exit(1)
  }
  if (filteredEvals.length === 0) {
    console.error(`No evaluations match filter: "${evalFilter}"`)
    process.exit(1)
  }

  const mcpUrl = process.env.MCP_SERVER_URL || DEFAULT_MCP_URL
  const runId = `mcp-${new Date().toISOString().replace(/[:.]/g, '-')}`

  let debugRunDirectory: string | undefined
  if (debugEnabled) {
    debugRunDirectory = path.join(process.cwd(), 'debug-runs', runId)
    await mkdir(debugRunDirectory, { recursive: true })
    console.log(`Debug mode enabled. Saving outputs to ${debugRunDirectory}`)
  }

  try {
    console.log(`Using MCP server at ${mcpUrl}\n`)

    const tasks = filteredModels.flatMap((model) =>
      filteredEvals.map((evaluation) => ({ model, evaluation })),
    )

    console.log(
      `Running ${tasks.length} tasks (${filteredModels.length} models x ${filteredEvals.length} evals)`,
    )

    let completed = 0

    await Promise.all(
      tasks.map(async ({ model, evaluation }) => {
        const evalPath = path.join(process.cwd(), 'src', evaluation.path)
        console.log(`[start] ${model.label} -> ${evaluation.path}`)

        const mcpArgs: MCPRunnerArgs = {
          evalPath,
          provider: model.provider as Provider,
          model: model.name,
          mcpServerUrl: mcpUrl,
          maxToolRounds: 10,
          debug: debugEnabled,
        }

        try {
          const result: RunnerResult = await mcpPool.run(mcpArgs)

          if (result.ok) {
            const score: Score = {
              model: model.name,
              label: `${model.label} (MCP)`,
              framework: evaluation.framework,
              category: evaluation.category,
              value: result.value.score,
              updatedAt: new Date().toISOString(),
            }
            saveResult(runId, score)

            if (debugEnabled && result.value.debug && debugRunDirectory) {
              const debugPath = path.join(
                debugRunDirectory,
                `${evaluation.path.replace(/\//g, '__')}__${model.name}.json`,
              )
              await writeFile(debugPath, JSON.stringify(result.value.debug, null, 2))

              if (result.value.debug.transcript) {
                const transcriptPath = path.join(
                  debugRunDirectory,
                  `${evaluation.path.replace(/\//g, '__')}__${model.name}.md`,
                )
                await writeFile(transcriptPath, result.value.debug.transcript)
              }
            }
          } else {
            console.error(`[error] ${model.label}: ${result.error}`)
            saveError(runId, {
              model: model.name,
              label: `${model.label} (MCP)`,
              framework: evaluation.framework,
              category: evaluation.category,
              evaluationPath: evaluation.path,
              error: result.error,
            })
          }
        } catch (err) {
          console.error(`[error] ${model.label}: ${err}`)
          saveError(runId, {
            model: model.name,
            label: `${model.label} (MCP)`,
            framework: evaluation.framework,
            category: evaluation.category,
            evaluationPath: evaluation.path,
            error: err,
          })
        }

        completed++
        console.log(`[done ${completed}/${tasks.length}] ${model.label} -> ${evaluation.path}`)
      }),
    )

    // Report results
    const dbScores = getResults(runId)
    fileReporter(dbScores, 'scores-mcp.json')
    if (debugEnabled) {
      consoleReporter(dbScores)
    } else {
      console.log('Scores written to: scores-mcp.json')
    }
  } finally {
    await mcpPool.destroy()
  }
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
