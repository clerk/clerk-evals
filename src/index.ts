import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { parseArgs } from 'node:util'

import Tinypool from 'tinypool'
import { EVALUATIONS, getAllModels, getModelsByProvider, loadConfig } from '@/src/config'
import { getResults, initDB, saveError, saveResult, saveRun } from '@/src/db'
import { getEvalKey, getGitCommit, getSuiteHash } from '@/src/eval-identity'
import type { ExecArgs, RunnerDebugPayload, RunnerResult, Score } from '@/src/interfaces'
import type { Provider } from '@/src/providers'
import type { BraintrustEntry } from '@/src/reporters/braintrust'
import consoleReporter from '@/src/reporters/console'
import fileReporter from '@/src/reporters/file'
import { estimateCost } from '@/src/runners/shared'

const DEFAULT_MCP_URL = 'https://mcp.clerk.dev/mcp' // Zero-config default

// CLI argument parsing
const { values } = parseArgs({
  args: Bun.argv,
  options: {
    mcp: { type: 'boolean', default: false },
    skills: { type: 'boolean', default: false },
    debug: { type: 'boolean', short: 'd', default: false },
    dry: { type: 'boolean', default: false },
    smoke: { type: 'boolean', default: false },
    'fail-under': { type: 'string' },
    model: { type: 'string', short: 'm' },
    provider: { type: 'string', short: 'p' },
    eval: { type: 'string', short: 'e' },
    'skills-path': { type: 'string' },
  },
  strict: true,
  allowPositionals: true,
})

const normalizeEvalPath = (value: string) => {
  if (value.startsWith('./')) return normalizeEvalPath(value.slice(2))
  if (value.startsWith('evals/')) return value
  return `evals/${value}`
}

// Parse flags
const mcpEnabled = values.mcp
const skillsEnabled = values.skills
const debugEnabled = values.debug
const dryRun = values.dry
const smokeTest = values.smoke
const failUnder = values['fail-under']
const modelFilter = values.model
const providerFilter = values.provider
const evalFilter = values.eval
const skillsPath = values['skills-path'] || path.join(process.cwd(), '..', 'skills', 'skills')

// Setup
initDB()

const config = await loadConfig(process.cwd())
if (config) {
  console.log(`Loaded config: ${config.name ?? 'clerk-evals'}`)
}

const effectiveFailUnder =
  failUnder ?? (config?.ci?.failUnder ? String(config.ci.failUnder) : undefined)

const models = providerFilter
  ? getModelsByProvider(providerFilter.toLowerCase() as Provider)
  : getAllModels()
const evaluations = EVALUATIONS

// Filter models - exact match on name only (case-insensitive, deterministic)
const filteredModels = modelFilter
  ? models.filter((m) => m.name.toLowerCase() === modelFilter.toLowerCase())
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
  const filter = modelFilter ? `model="${modelFilter}"` : `provider="${providerFilter}"`
  console.error(`No models match filter: ${filter}`)
  process.exit(1)
}

// Mode detection — reused for runId, labels, output file, reporters
const modeLabel = (() => {
  if (skillsEnabled) return 'skills' as const
  if (mcpEnabled) return 'mcp' as const
  return 'baseline' as const
})()
const hasTools = modeLabel !== 'baseline'
const pool = new Tinypool({
  runtime: 'child_process',
  filename: new URL('./runners/exec.ts', import.meta.url).href,
  isolateWorkers: true,
  idleTimeout: hasTools ? 30000 : 10000,
  maxThreads: hasTools ? 8 : 10,
})

const MODE_LABEL_SUFFIX: Record<typeof modeLabel, string> = {
  baseline: '',
  mcp: ' (MCP)',
  skills: ' (Skills)',
}
const mcpUrl = process.env.MCP_SERVER_URL_OVERRIDE || DEFAULT_MCP_URL
const runIdPrefix = modeLabel === 'baseline' ? '' : `${modeLabel}-`
const runId = `${runIdPrefix}${new Date().toISOString().replace(/[:.]/g, '-')}`
const suiteHash = await getSuiteHash(filteredEvaluations)
const harnessCommit = getGitCommit()
const skillsCommit = skillsEnabled ? getGitCommit(skillsPath) : undefined

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
  finishReason?: string
}

const debugArtifacts: DebugArtifact[] = []
const braintrustDebugMap = new Map<string, { debug: RunnerDebugPayload; evaluationPath: string }>()

// Collect debug payloads for Braintrust even without --debug flag
const collectDebug = debugEnabled || !!process.env.BRAINTRUST_API_KEY

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
    variant: evaluation.variant,
    evalKey: getEvalKey(evaluation),
    evalPath: path.join(process.cwd(), 'src', evaluation.path),
    evaluationPath: evaluation.path,
  })),
)

// Progress output
const modeDisplay = (() => {
  if (modeLabel === 'skills') return `Skills (${skillsPath})`
  if (modeLabel === 'mcp') return `MCP (${mcpUrl})`
  return 'baseline'
})()
console.log(
  `\nMode: ${modeDisplay} | ${tasks.length} tasks (${filteredModels.length} models x ${filteredEvaluations.length} evals)\n`,
)

// Dry run: print summary table and exit
if (dryRun) {
  const modelNames = [...new Set(tasks.map((t) => t.label))]
  const categories = [...new Set(tasks.map((t) => t.category))]
  const evalsByCategory = new Map<string, string[]>()
  for (const t of tasks) {
    if (!evalsByCategory.has(t.category)) evalsByCategory.set(t.category, [])
    const paths = evalsByCategory.get(t.category)
    if (paths && !paths.includes(t.evaluationPath)) paths.push(t.evaluationPath)
  }

  console.log(`Models (${modelNames.length}):`)
  for (const name of modelNames) console.log(`  - ${name}`)

  console.log(`\nEvals by category:`)
  for (const cat of categories) {
    const evals = evalsByCategory.get(cat) ?? []
    console.log(`  ${cat} (${evals.length})`)
    for (const e of evals) console.log(`    - ${e.split('/').pop()}`)
  }

  console.log(`\nDry run: ${tasks.length} tasks would be executed.`)
  process.exit(0)
}

// Smoke test: run only the first task
const tasksToRun = smokeTest ? tasks.slice(0, 1) : tasks
if (smokeTest) {
  console.log(`Smoke test: running 1 of ${tasks.length} tasks\n`)
}

saveRun({
  runId,
  mode: modeLabel,
  models: [...new Set(tasksToRun.map((task) => task.model))],
  evalKeys: [...new Set(tasksToRun.map((task) => task.evalKey))],
  suiteHash,
  harnessCommit,
  skillsCommit,
  mcpServerUrl: modeLabel === 'mcp' ? mcpUrl : undefined,
})

let completed = 0
let errors = 0
const isTTY = process.stdout.isTTY ?? false
const evalConcurrency = Number(process.env.EVAL_CONCURRENCY ?? tasksToRun.length)
const evalDelayMs = Number(process.env.EVAL_DELAY_MS ?? 0)

function logProgress(task: { label: string; evaluationPath: string }, status: string) {
  if (isTTY) {
    process.stdout.write(
      `\r[${completed}/${tasksToRun.length}] ${status}: ${task.label} -> ${task.evaluationPath.split('/').pop()}    `,
    )
  }
}

// Lifecycle: preEval
if (config?.hooks?.preEval) {
  try {
    await config.hooks.preEval()
  } catch (e) {
    console.error('[hook:preEval]', e)
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function runTask(task: (typeof tasksToRun)[number]) {
  logProgress(task, 'running')

  const runnerArgs: ExecArgs = {
    evalPath: task.evalPath,
    variant: task.variant,
    provider: task.provider as Provider,
    model: task.model,
    debug: collectDebug,
    ...(modeLabel === 'mcp' && { mcpServerUrl: mcpUrl }),
    ...(modeLabel === 'skills' && { skillsPath }),
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
      console.error(
        `\n[error] ${task.label} -> ${task.evaluationPath.split('/').pop()}: ${errorMsg}`,
      )
      const labelSuffix = MODE_LABEL_SUFFIX[modeLabel]
      saveError(runId, {
        model: task.model,
        label: `${task.label}${labelSuffix}`,
        framework: task.framework,
        category: task.category,
        evaluationPath: task.evaluationPath,
        error: result.error,
      })
      errors++
      if (config?.hooks?.onError) {
        try {
          await config.hooks.onError({
            model: task.model,
            category: task.category,
            error: result.error,
          })
        } catch (e) {
          console.error('[hook:onError]', e)
        }
      }
      return
    }

    const scoreLabelSuffix = MODE_LABEL_SUFFIX[modeLabel]
    const score: Score = {
      model: task.model,
      label: `${task.label}${scoreLabelSuffix}`,
      framework: task.framework,
      category: task.category,
      value: result.value.score,
      updatedAt: new Date().toISOString(),
      tokens: result.value.tokens,
      durationMs: result.value.durationMs,
      costUsd: result.value.tokens ? estimateCost(task.model, result.value.tokens) : undefined,
      evalKey: task.evalKey,
    }
    saveResult(runId, score, task.evaluationPath, task.evalKey)
    if (config?.hooks?.onSuccess) {
      try {
        await config.hooks.onSuccess({
          model: task.model,
          category: task.category,
          score: result.value.score,
        })
      } catch (e) {
        console.error('[hook:onSuccess]', e)
      }
    }

    // Collect debug data for Braintrust (even without --debug flag)
    if (result.value.debug) {
      braintrustDebugMap.set(`${task.model}::${task.evalKey}`, {
        debug: result.value.debug,
        evaluationPath: task.evaluationPath,
      })
    }

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
        finishReason: result.value.debug.finishReason,
      }
      debugArtifacts.push(artifact)

      // Write debug files immediately for tool-using modes (MCP, Skills)
      if (hasTools) {
        const debugPath = path.join(
          debugRunDirectory,
          `${task.evaluationPath.replace(/\//g, '__')}${task.variant ? `__${task.variant}` : ''}__${task.model}.json`,
        )
        await writeFile(debugPath, JSON.stringify(result.value.debug, null, 2))

        if (result.value.debug.transcript) {
          const transcriptPath = path.join(
            debugRunDirectory,
            `${task.evaluationPath.replace(/\//g, '__')}${task.variant ? `__${task.variant}` : ''}__${task.model}.md`,
          )
          await writeFile(transcriptPath, result.value.debug.transcript)
        }
      }
    }
  } finally {
    completed++
    logProgress(task, 'done')
  }
}

async function runWithConcurrencyLimit() {
  const concurrency = Number.isFinite(evalConcurrency)
    ? Math.max(1, Math.min(tasksToRun.length, evalConcurrency))
    : tasksToRun.length
  let nextTaskIndex = 0

  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (nextTaskIndex < tasksToRun.length) {
        const task = tasksToRun[nextTaskIndex]
        nextTaskIndex++
        if (!task) return
        await runTask(task)
        if (evalDelayMs > 0 && nextTaskIndex < tasksToRun.length) {
          await sleep(evalDelayMs)
        }
      }
    }),
  )
}

await runWithConcurrencyLimit()

if (isTTY) process.stdout.write(`\r${' '.repeat(80)}\r`)
console.log(
  `Completed: ${completed}/${tasksToRun.length} tasks${errors > 0 ? ` (${errors} errors)` : ''}`,
)

// Lifecycle: postEval
if (config?.hooks?.postEval) {
  try {
    const allScores = getResults(runId)
    await config.hooks.postEval({
      scores: allScores.map((s) => ({ category: s.category, value: s.value })),
    })
  } catch (e) {
    console.error('[hook:postEval]', e)
  }
}

// Write baseline debug artifacts (non-tool mode)
if (debugEnabled && debugRunDirectory && !hasTools) {
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
finishReason: ${artifact.finishReason ?? 'unknown'}
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
const outputFile = modeLabel === 'baseline' ? 'scores.json' : `scores-${modeLabel}.json`
const dbScores = getResults(runId)
fileReporter(dbScores, outputFile)

if (debugEnabled) {
  consoleReporter(dbScores)
}

// Always print a compact score summary grouped by model
if (dbScores.length > 0) {
  const isTTY = process.stdout.isTTY ?? false
  const green = isTTY ? '\x1b[32m' : ''
  const yellow = isTTY ? '\x1b[33m' : ''
  const red = isTTY ? '\x1b[31m' : ''
  const dim = isTTY ? '\x1b[2m' : ''
  const reset = isTTY ? '\x1b[0m' : ''
  const colorPct = (v: number) => {
    const pct = `${(v * 100).toFixed(0)}%`
    if (v >= 0.8) return `${green}${pct}${reset}`
    if (v >= 0.5) return `${yellow}${pct}${reset}`
    return `${red}${pct}${reset}`
  }

  // Group scores by model label
  const byModel = new Map<string, typeof dbScores>()
  for (const s of dbScores) {
    if (!byModel.has(s.label)) byModel.set(s.label, [])
    byModel.get(s.label)?.push(s)
  }

  console.log()
  for (const [label, scores] of byModel) {
    const avg = scores.reduce((sum, s) => sum + s.value, 0) / scores.length
    // Show eval-level breakdown inline
    const evalDetails = scores
      .map((s) => {
        const evalName = s.evalKey ?? s.evaluationPath?.split('/').pop() ?? s.category
        return `${evalName} ${colorPct(s.value)}`
      })
      .join(`${dim} | ${reset}`)
    console.log(`  ${label}: ${colorPct(avg)} avg ${dim}(${evalDetails})${reset}`)
  }

  const totalAvg = dbScores.reduce((sum, s) => sum + s.value, 0) / dbScores.length
  console.log(`\n  Overall: ${colorPct(totalAvg)} across ${byModel.size} models | ${outputFile}`)
} else {
  console.log(`Scores written to: ${outputFile}`)
}

// Braintrust export (opt-in via BRAINTRUST_API_KEY).
// Skip when BRAINTRUST_DEFER_REPORT=1 (batch mode — report-braintrust.ts handles it).
if (process.env.BRAINTRUST_API_KEY && !process.env.BRAINTRUST_DEFER_REPORT) {
  const entries: BraintrustEntry[] = dbScores.map((score) => {
    const extra = braintrustDebugMap.get(`${score.model}::${score.evalKey ?? score.category}`)
    return {
      ...score,
      evaluationPath: extra?.evaluationPath ?? '',
      debug: extra?.debug,
    }
  })
  const { default: braintrustReporter } = await import('@/src/reporters/braintrust')
  await braintrustReporter(entries, runId, modeLabel)
}

await pool.destroy()

// CI gate: fail if average score is below threshold
if (effectiveFailUnder) {
  const threshold = Number.parseFloat(effectiveFailUnder) / 100
  if (dbScores.length === 0) {
    console.error('No scores to evaluate against --fail-under threshold')
    process.exit(1)
  }
  const avgScore = dbScores.reduce((sum, s) => sum + s.value, 0) / dbScores.length
  if (avgScore < threshold) {
    console.error(
      `FAIL: Average score ${(avgScore * 100).toFixed(1)}% is below threshold ${effectiveFailUnder}%`,
    )
    process.exit(1)
  }
  console.log(
    `PASS: Average score ${(avgScore * 100).toFixed(1)}% meets threshold ${effectiveFailUnder}%`,
  )
}
