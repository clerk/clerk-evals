import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

import Tinypool from 'tinypool'

import type {
  Evaluation,
  RunnerArgs,
  RunnerDebugPayload,
  RunnerResult,
  Score,
} from '@/src/interfaces'
import type { ModelInfo, Provider } from '@/src/providers'
import consoleReporter from '@/src/reporters/console'
import fileReporter from '@/src/reporters/file'
import { rateLimiter } from '@/src/utils/rate-limiter'

// Create a pool of workers to execute the main runner
const pool = new Tinypool({
  runtime: 'child_process',
  filename: new URL('./runners/main.ts', import.meta.url).href,
  isolateWorkers: true,
  idleTimeout: 10000,
  maxThreads: 10,
})

/**
 * Registered models
 * To be manually updated
 */
const models: ModelInfo[] = [
  { provider: 'openai', name: 'gpt-4o', label: 'GPT-4o' },
  { provider: 'openai', name: 'gpt-5', label: 'GPT-5' },
  { provider: 'openai', name: 'gpt-5-chat-latest', label: 'GPT-5 Chat' },
  { provider: 'anthropic', name: 'claude-sonnet-4-0', label: 'Claude Sonnet 4' },
  { provider: 'anthropic', name: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5' },
  { provider: 'anthropic', name: 'claude-opus-4-0', label: 'Claude Opus 4' },
  { provider: 'vercel', name: 'v0-1.5-md', label: 'v0-1.5-md' },
]

/**
 * Registered evaluations
 * To be manually updated
 */
const evaluations = [
  {
    framework: 'React',
    category: 'Setup',
    path: 'evals/basic-setup',
  },
  {
    framework: 'React',
    category: 'Authentication',
    path: 'evals/authentication',
  },
  {
    framework: 'React',
    category: 'Embedded Wallets',
    path: 'evals/embedded-wallets',
  },
  {
    framework: 'React',
    category: 'Wallet Recovery',
    path: 'evals/wallet-recovery',
  },
  {
    framework: 'React',
    category: 'Wallet Actions',
    path: 'evals/wallet-actions',
  },
  {
    framework: 'React',
    category: 'Hooks',
    path: 'evals/hooks-usage',
  },
] satisfies Evaluation[]

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
}

type DebugError = {
  provider: string
  model: string
  evaluationPath: string
  error: unknown
}

const args = process.argv.slice(2)

const showHelp = () => {
  console.log(`
Openfort Evals - Evaluate LLMs on Openfort code generation

Usage:
  bun start [options]

Options:
  --help, -h              Show this help message
  --eval, -e <path>       Run a specific evaluation (e.g., evals/basic-setup)
  --model, -m <models>    Run only for specific model(s) (e.g., gpt-4o or gpt-4o,claude-sonnet-4-5)
  --debug, -d             Enable debug mode (saves prompts, responses, and grading details)

Available models:
${models.map((m) => `  - ${m.name} (${m.label})`).join('\n')}

Available evaluations:
${evaluations.map((e) => `  - ${e.path} (${e.category})`).join('\n')}

Examples:
  bun start                                      # Run all evals on all models
  bun start --eval evals/basic-setup             # Run one eval on all models
  bun start --model claude-sonnet-4-5            # Run all evals on one model
  bun start --model gpt-4o,claude-sonnet-4-5     # Run all evals on multiple models
  bun start --eval evals/basic-setup --model gpt-4o --debug
`)
  process.exit(0)
}

const parseBooleanFlag = (name: string, alias?: string) => {
  const equalsArg = args.find((arg) => arg.startsWith(`--${name}=`))
  if (equalsArg) {
    const [, rawValue] = equalsArg.split('=', 2)
    const value = rawValue?.toLowerCase()
    return !['false', '0', 'no'].includes(value ?? '')
  }

  const index = args.findIndex((arg) => arg === `--${name}` || (alias && arg === alias))

  if (index === -1) {
    return false
  }

  const value = args[index + 1]
  if (value && !value.startsWith('-')) {
    return !['false', '0', 'no'].includes(value.toLowerCase())
  }

  return true
}

const getEvalArg = () => {
  const equalsArg = args.find((arg) => arg.startsWith('--eval='))
  if (equalsArg) {
    return equalsArg.split('=', 2)[1]
  }

  const index = args.findIndex((arg) => arg === '--eval' || arg === '-e')
  if (index === -1) {
    return undefined
  }

  const value = args[index + 1]
  if (!value || value.startsWith('-')) {
    console.error('Missing value for --eval')
    process.exit(1)
  }

  return value
}

const getModelArg = () => {
  const equalsArg = args.find((arg) => arg.startsWith('--model='))
  if (equalsArg) {
    const value = equalsArg.split('=', 2)[1]
    return value?.split(',').map((m) => m.trim()).filter(Boolean)
  }

  const index = args.findIndex((arg) => arg === '--model' || arg === '-m')
  if (index === -1) {
    return undefined
  }

  const value = args[index + 1]
  if (!value || value.startsWith('-')) {
    console.error('Missing value for --model')
    process.exit(1)
  }

  return value.split(',').map((m) => m.trim()).filter(Boolean)
}

const normalizeEvalPath = (value: string) => {
  if (value.startsWith('./')) {
    return normalizeEvalPath(value.slice(2))
  }
  if (value.startsWith('evals/')) {
    return value
  }
  return `evals/${value}`
}

// Check for help flag first
if (args.includes('--help') || args.includes('-h')) {
  showHelp()
}

const evalArg = getEvalArg()
const modelArg = getModelArg()

const debugEnabled = parseBooleanFlag('debug', '-d')

const selectedEvaluations = (() => {
  if (!evalArg) {
    return evaluations
  }

  const normalized = normalizeEvalPath(evalArg)
  const target = evaluations.find(
    (evaluation) =>
      evaluation.path === normalized ||
      evaluation.path.endsWith(`/${normalized}`) ||
      evaluation.path.endsWith(`/${evalArg}`),
  )

  if (!target) {
    console.error(
      `No evaluation matching "${evalArg}". Available evaluations: ${evaluations
        .map((evaluation) => evaluation.path)
        .join(', ')}`,
    )
    process.exit(1)
  }

  console.log(`Running single evaluation "${target.path}" for all registered models`)

  return [target]
})()

const selectedModels = (() => {
  if (!modelArg || modelArg.length === 0) {
    return models
  }

  const targets = modelArg.map((arg) => {
    const target = models.find(
      (model) => model.name === arg || model.label === arg,
    )

    if (!target) {
      console.error(
        `No model matching "${arg}". Available models: ${models
          .map((model) => `${model.name} (${model.label})`)
          .join(', ')}`,
      )
      process.exit(1)
    }

    return target
  })

  if (targets.length === 1 && targets[0]) {
    console.log(`Running for single model "${targets[0].name}" (${targets[0].label})`)
  } else {
    console.log(
      `Running for ${targets.length} models: ${targets.map((m) => m.name).join(', ')}`,
    )
  }

  return targets
})()

const debugArtifacts: DebugArtifact[] = []
const debugErrors: DebugError[] = []

let debugRunDirectory: string | undefined
let debugRunTimestamp: string | undefined

if (debugEnabled) {
  debugRunTimestamp = new Date().toISOString().replace(/[:.]/g, '-')
  debugRunDirectory = path.join(process.cwd(), 'debug-runs', debugRunTimestamp)
  await mkdir(debugRunDirectory, { recursive: true })
  console.log(`Debug mode enabled. Saving outputs to ${debugRunDirectory}`)
}

// Collect list of tasks to be run
const tasks = selectedModels.flatMap((model) =>
  selectedEvaluations.map((evaluation) => ({
    provider: model.provider,
    model: model.name,
    label: model.label,
    category: evaluation.category,
    framework: evaluation.framework,
    evalPath: new URL(evaluation.path, import.meta.url).pathname,
    evaluationPath: evaluation.path,
  })),
)

// Accumulate scores
const scores: Score[] = []

// Progress output
console.log(
  `Starting ${tasks.length} tasks across ${selectedModels.length} models and ${selectedEvaluations.length} evaluations (up to 10 workers)...`,
)

let completed = 0

// Run all tasks with rate limiting per provider
await Promise.all(
  tasks.map(async (task, index) => {
    console.log(`[start ${index + 1}/${tasks.length}] ${task.model} → ${task.evaluationPath}`)
    const runnerArgs: RunnerArgs = {
      evalPath: task.evalPath,
      provider: task.provider as Provider,
      model: task.model,
      debug: debugEnabled,
    }

    try {
      // Schedule task through rate limiter to prevent API rate limit errors
      const result: RunnerResult = await rateLimiter.schedule(task.provider, () =>
        pool.run(runnerArgs),
      )

      if (!result.ok) {
        console.log({
          message: 'Runner errored',
          task,
          error: result.error,
        })
        if (debugEnabled) {
          debugErrors.push({
            provider: task.provider,
            model: task.model,
            evaluationPath: task.evaluationPath,
            error: result.error,
          })
        }
        return
      }

      const score: Score = {
        model: task.model,
        label: task.label,
        framework: task.framework,
        category: task.category,
        value: result.value.score,
        updatedAt: new Date().toISOString(),
      }
      scores.push(score)

      if (debugEnabled && result.value.debug) {
        debugArtifacts.push({
          provider: task.provider,
          model: task.model,
          framework: task.framework,
          category: task.category,
          evaluationPath: task.evaluationPath,
          score: result.value.score,
          prompt: result.value.debug.prompt,
          response: result.value.debug.response,
          graders: result.value.debug.graders,
        })
      }
    } finally {
      completed += 1
      console.log(`[done  ${completed}/${tasks.length}] ${task.model} → ${task.evaluationPath}`)
    }
  }),
)

const sanitizeForFilename = (value: string) => value.replace(/[^a-zA-Z0-9._-]/g, '_')

if (debugEnabled && debugRunDirectory && debugRunTimestamp) {
  for (const artifact of debugArtifacts) {
    const evaluationSlug = artifact.evaluationPath.split('/').filter(Boolean).join('__')
    const evaluationDir = path.join(debugRunDirectory, evaluationSlug)
    await mkdir(evaluationDir, { recursive: true })

    const fileSafeName = sanitizeForFilename(`${artifact.provider}__${artifact.model}`)

    const gradersRows =
      artifact.graders.length > 0
        ? artifact.graders
            .map(
              // TODO(voz): To make things pretty we could swap true/false for ✅/❌
              ([name, passed]) => `| ${name} | ${passed ? 'true' : 'false'} |`,
            )
            .join('\n')
        : '| (none) | - |'

    const debugContent = `---
provider: ${artifact.provider}
model: ${artifact.model}
framework: ${artifact.framework}
category: ${artifact.category}
evaluation: ${artifact.evaluationPath}
score: ${artifact.score.toFixed(2)}
run_at: ${debugRunTimestamp}
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

    const filePath = path.join(evaluationDir, `${fileSafeName}.md`)
    await writeFile(filePath, debugContent, 'utf8')
  }

  if (debugErrors.length > 0) {
    const errorsPath = path.join(debugRunDirectory, 'errors.json')
    await writeFile(errorsPath, JSON.stringify(debugErrors, null, 2), 'utf8')
  }
}

// Report
fileReporter(scores)
if (debugEnabled) {
  consoleReporter(scores)
} else {
  console.log('Scores written to: scores.json')
}
