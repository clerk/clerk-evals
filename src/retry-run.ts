import path from 'node:path'
import { parseArgs } from 'node:util'

import { EVALUATIONS, getAllModels } from '@/src/config'
import { getErrors, getResults, getRun, initDB, saveError, saveResult } from '@/src/db'
import { getEvalKey } from '@/src/eval-identity'
import type { ExecArgs, Score } from '@/src/interfaces'
import fileReporter from '@/src/reporters/file'
import exec from '@/src/runners/exec'
import { estimateCost } from '@/src/runners/shared'
import { getEvalTaskTimeoutMs } from '@/src/runners/timeout'
import { formatError } from '@/src/utils/error'

const DEFAULT_MCP_URL = 'https://mcp.clerk.dev/mcp'
const SUPPORTED_MODES = ['baseline', 'mcp', 'skills', 'skills-mcp'] as const
type Mode = (typeof SUPPORTED_MODES)[number]

const [runId, ...cliArgs] = Bun.argv.slice(2)
if (!runId) {
  console.error(
    'Usage: bun retry:run <run-id> [--concurrency 1] [--timeout 300000] [--max-retries 2] [--model name] [--eval path] [--debug]',
  )
  process.exit(1)
}

const { values } = parseArgs({
  args: cliArgs,
  options: {
    concurrency: { type: 'string', short: 'c', default: '1' },
    timeout: { type: 'string', short: 't' },
    'max-output-tokens': { type: 'string' },
    'max-retries': { type: 'string' },
    model: { type: 'string', short: 'm' },
    eval: { type: 'string', short: 'e' },
    'skills-path': { type: 'string' },
    debug: { type: 'boolean', short: 'd', default: false },
  },
  strict: true,
})

initDB()

const run = getRun(runId)
if (!run) {
  console.error(`Run not found: ${runId}`)
  process.exit(1)
}
if (!SUPPORTED_MODES.includes(run.mode as Mode)) {
  console.error(`Run mode cannot be retried: ${run.mode}`)
  process.exit(1)
}

const mode = run.mode as Mode
const timeoutMs = getEvalTaskTimeoutMs(values.timeout ?? process.env.EVAL_TASK_TIMEOUT_MS)
const maxRetries = values['max-retries'] ? Number(values['max-retries']) : undefined
if (maxRetries !== undefined && (!Number.isInteger(maxRetries) || maxRetries < 0)) {
  console.error(`Max retries must be a non-negative integer, received: ${values['max-retries']}`)
  process.exit(1)
}
const requestedConcurrency = Number(values.concurrency)
if (!Number.isInteger(requestedConcurrency) || requestedConcurrency <= 0) {
  console.error(`Retry concurrency must be a positive integer, received: ${values.concurrency}`)
  process.exit(1)
}

const skillsPath = values['skills-path'] || path.join(process.cwd(), '..', 'skills', 'skills')
const mcpServerUrl = run.mcpServerUrl || process.env.MCP_SERVER_URL_OVERRIDE || DEFAULT_MCP_URL
const successfulKeys = new Set(getResults(runId).map((score) => `${score.model}::${score.evalKey}`))
const modelsByName = new Map(getAllModels().map((model) => [model.name, model]))
const evaluationsByIdentity = new Map(
  EVALUATIONS.map((evaluation) => [
    `${evaluation.path}::${evaluation.framework}::${evaluation.category}`,
    evaluation,
  ]),
)

const retryTasks = new Map<
  string,
  {
    model: NonNullable<ReturnType<typeof modelsByName.get>>
    evaluation: (typeof EVALUATIONS)[number]
  }
>()

for (const error of getErrors(runId)) {
  if (values.model && error.model !== values.model) continue
  if (values.eval && !error.evaluationPath.includes(values.eval)) continue

  const model = modelsByName.get(error.model)
  const evaluation = evaluationsByIdentity.get(
    `${error.evaluationPath}::${error.framework}::${error.category}`,
  )
  if (!model || !evaluation) {
    console.warn(
      `Cannot map retry cell: ${error.model} ${error.evaluationPath} ${error.framework ?? ''}`,
    )
    continue
  }

  const evalKey = getEvalKey(evaluation)
  const taskKey = `${model.name}::${evalKey}`
  if (!successfulKeys.has(taskKey)) retryTasks.set(taskKey, { model, evaluation })
}

const tasks = [...retryTasks.values()]
console.log(
  `Retrying ${tasks.length} missing ${mode} cells from ${runId} at concurrency ${requestedConcurrency}.`,
)

const suffix: Record<Mode, string> = {
  baseline: '',
  mcp: ' (MCP)',
  skills: ' (Skills)',
  'skills-mcp': ' (Skills + MCP)',
}

let nextTask = 0
let recovered = 0

await Promise.all(
  Array.from({ length: Math.min(requestedConcurrency, tasks.length) }, async () => {
    while (nextTask < tasks.length) {
      const task = tasks[nextTask]
      nextTask++
      if (!task) return

      const { model, evaluation } = task
      const runnerArgs: ExecArgs = {
        provider: model.provider,
        model: model.name,
        evalPath: path.join(process.cwd(), 'src', evaluation.path),
        variant: evaluation.variant,
        debug: values.debug,
        timeoutMs,
        maxRetries,
        ...(values['max-output-tokens'] && {
          maxOutputTokens: Number(values['max-output-tokens']),
        }),
        ...(mode.includes('mcp') && { mcpServerUrl }),
        ...(mode.includes('skills') && { skillsPath }),
      }
      const result = await exec(runnerArgs)

      if (!result.ok) {
        saveError(runId, {
          model: model.name,
          label: `${model.label}${suffix[mode]}`,
          framework: evaluation.framework,
          category: evaluation.category,
          evaluationPath: evaluation.path,
          error: result.error,
        })
        console.error(
          `[error] ${model.label} -> ${getEvalKey(evaluation)}: ${formatError(result.error)}`,
        )
        continue
      }

      const score: Score = {
        model: model.name,
        label: `${model.label}${suffix[mode]}`,
        framework: evaluation.framework,
        category: evaluation.category,
        value: result.value.score,
        updatedAt: new Date().toISOString(),
        tokens: result.value.tokens,
        durationMs: result.value.durationMs,
        costUsd: result.value.tokens ? estimateCost(model.name, result.value.tokens) : undefined,
        evalKey: getEvalKey(evaluation),
      }
      saveResult(runId, score, evaluation.path, score.evalKey)
      recovered++
      console.log(`[recovered] ${model.label} -> ${score.evalKey}`)
    }
  }),
)

const outputFile = mode === 'baseline' ? 'scores.json' : `scores-${mode}.json`
const scores = getResults(runId)
fileReporter(scores, outputFile)
console.log(
  `Recovered ${recovered}/${tasks.length} cells. ${scores.length} results written to ${outputFile}.`,
)
