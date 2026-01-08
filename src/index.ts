import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

import Tinypool from 'tinypool'
import { EVALUATIONS, getAllModels } from '@/src/config'
import { getResults, initDB, saveError, saveResult } from '@/src/db'
import type {
  MCPRunnerArgs,
  RunnerArgs,
  RunnerDebugPayload,
  RunnerResult,
  Score,
} from '@/src/interfaces'
import type { Provider } from '@/src/providers'
import consoleReporter from '@/src/reporters/console'
import fileReporter from '@/src/reporters/file'

const DEFAULT_MCP_URL = 'https://mcp.clerk.dev/mcp' // Zero-config default

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
const mcpEnabled = parseBooleanFlag('mcp')
const debugEnabled = parseBooleanFlag('debug', '-d')
const modelFilter = parseStringArg('model', '-m')
const evalFilter = parseStringArg('eval', '-e')

// Setup
initDB()
const models = getAllModels()
const evaluations = EVALUATIONS

// Filter models
const filteredModels = modelFilter
  ? models.filter((m) => m.label.toLowerCase().includes(modelFilter.toLowerCase()))
  : models

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

if (filteredModels.length === 0) {
  console.error(`No models match filter: "${modelFilter}"`)
  process.exit(1)
}

// Create pool with appropriate runner
const runnerPath = mcpEnabled ? './runners/mcp.ts' : './runners/main.ts'
const pool = new Tinypool({
  runtime: 'child_process',
  filename: new URL(runnerPath, import.meta.url).href,
  isolateWorkers: true,
  idleTimeout: mcpEnabled ? 30000 : 10000,
  maxThreads: mcpEnabled ? 8 : 10,
})

const mcpUrl = process.env.MCP_SERVER_URL_OVERRIDE || DEFAULT_MCP_URL
const runId = `${mcpEnabled ? 'mcp-' : ''}${new Date().toISOString().replace(/[:.]/g, '-')}`

type DebugArtifact = {
  provider: string
  model: string
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
const tasks = filteredModels.flatMap((model) =>
  filteredEvaluations.map((evaluation) => ({
    provider: model.provider,
    model: model.name,
    label: model.label,
    category: evaluation.category,
    framework: evaluation.framework,
    evalPath: mcpEnabled
      ? path.join(process.cwd(), 'src', evaluation.path)
      : new URL(evaluation.path, import.meta.url).pathname,
    evaluationPath: evaluation.path,
  })),
)

// Progress output
const mode = mcpEnabled ? `MCP (${mcpUrl})` : 'baseline'
console.log(`\nMode: ${mode}`)
console.log(
  `Running ${tasks.length} tasks (${filteredModels.length} models x ${filteredEvaluations.length} evals)\n`,
)

let completed = 0

// Run all in parallel
await Promise.all(
  tasks.map(async (task) => {
    console.log(`[start] ${task.label} -> ${task.evaluationPath}`)

    const baseArgs = {
      evalPath: task.evalPath,
      provider: task.provider as Provider,
      model: task.model,
      debug: debugEnabled,
    }

    const runnerArgs: RunnerArgs | MCPRunnerArgs = mcpEnabled
      ? { ...baseArgs, mcpServerUrl: mcpUrl, maxToolRounds: 10 }
      : baseArgs

    try {
      const result: RunnerResult = await pool.run(runnerArgs)

      if (!result.ok) {
        console.error(`[error] ${task.label}: ${result.error}`)
        saveError(runId, {
          model: task.model,
          label: mcpEnabled ? `${task.label} (MCP)` : task.label,
          framework: task.framework,
          category: task.category,
          evaluationPath: task.evaluationPath,
          error: result.error,
        })
        return
      }

      const score: Score = {
        model: task.model,
        label: mcpEnabled ? `${task.label} (MCP)` : task.label,
        framework: task.framework,
        category: task.category,
        value: result.value.score,
        updatedAt: new Date().toISOString(),
      }
      saveResult(runId, score)

      if (debugEnabled && result.value.debug && debugRunDirectory) {
        const artifact: DebugArtifact = {
          provider: task.provider,
          model: task.model,
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

        // Write debug files immediately for MCP mode
        if (mcpEnabled) {
          const debugPath = path.join(
            debugRunDirectory,
            `${task.evaluationPath.replace(/\//g, '__')}__${task.model}.json`,
          )
          await writeFile(debugPath, JSON.stringify(result.value.debug, null, 2))

          if (result.value.debug.transcript) {
            const transcriptPath = path.join(
              debugRunDirectory,
              `${task.evaluationPath.replace(/\//g, '__')}__${task.model}.md`,
            )
            await writeFile(transcriptPath, result.value.debug.transcript)
          }
        }
      }
    } finally {
      completed++
      console.log(`[done ${completed}/${tasks.length}] ${task.label} -> ${task.evaluationPath}`)
    }
  }),
)

// Write baseline debug artifacts (non-MCP mode)
if (debugEnabled && debugRunDirectory && !mcpEnabled) {
  const sanitize = (v: string) => v.replace(/[^a-zA-Z0-9._-]/g, '_')

  for (const artifact of debugArtifacts) {
    const evalSlug = artifact.evaluationPath.split('/').filter(Boolean).join('__')
    const evalDir = path.join(debugRunDirectory, evalSlug)
    await mkdir(evalDir, { recursive: true })

    const fileName = sanitize(`${artifact.provider}__${artifact.model}`)
    const gradersRows =
      artifact.graders.length > 0
        ? artifact.graders.map(([name, passed]) => `| ${name} | ${passed} |`).join('\n')
        : '| (none) | - |'

    const content = `---
provider: ${artifact.provider}
model: ${artifact.model}
framework: ${artifact.framework}
category: ${artifact.category}
evaluation: ${artifact.evaluationPath}
score: ${artifact.score.toFixed(2)}
---

## Prompt
~~~
${artifact.prompt.trimEnd()}
~~~

## Response
~~~
${artifact.response.trimEnd()}
~~~

## Graders
| name | passed |
| --- | --- |
${gradersRows}
`
    await writeFile(path.join(evalDir, `${fileName}.md`), content, 'utf8')
  }
}

// Report
const outputFile = mcpEnabled ? 'scores-mcp.json' : 'scores.json'
const dbScores = getResults(runId)
fileReporter(dbScores, outputFile)

if (debugEnabled) {
  consoleReporter(dbScores)
} else {
  console.log(`Scores written to: ${outputFile}`)
}

await pool.destroy()
