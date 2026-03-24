/**
 * Standalone Braintrust reporter — consolidates batch results into single experiments.
 *
 * Solves the deduplication problem: when run-evals.sh runs `bun start --model X`
 * per model, each creates a separate Braintrust experiment. This script reads ALL
 * results from SQLite and creates ONE experiment per mode.
 *
 * Usage:
 *   bun report:braintrust                    # Report latest run_ids
 *   bun report:braintrust --since 2026-03-19T17:00:00Z  # Report results since timestamp
 *   bun report:braintrust --run-ids "id1,id2,id3"       # Report specific run_ids
 */
import { type DBScore, getResults, getResultsSince, getRunIdsSince, initDB } from '@/src/db'
import type { BraintrustEntry } from '@/src/reporters/braintrust'
import braintrustReporter from '@/src/reporters/braintrust'

const args = process.argv.slice(2)

function parseArg(name: string): string | undefined {
  const equalsArg = args.find((arg) => arg.startsWith(`--${name}=`))
  if (equalsArg) return equalsArg.split('=', 2)[1]
  const idx = args.indexOf(`--${name}`)
  if (idx !== -1 && args[idx + 1] && !args[idx + 1].startsWith('-')) return args[idx + 1]
  return undefined
}

if (!process.env.BRAINTRUST_API_KEY) {
  console.error('BRAINTRUST_API_KEY is required. Set it in your environment.')
  process.exit(1)
}

initDB()

// Determine which results to report
const sinceArg = parseArg('since')
const runIdsArg = parseArg('run-ids')

let allScores: DBScore[]

if (runIdsArg) {
  // Specific run_ids provided
  const ids = runIdsArg.split(',').map((s) => s.trim())
  allScores = ids.flatMap((id) => getResults(id))
  console.log(`Loaded ${allScores.length} results from ${ids.length} run_ids`)
} else if (sinceArg) {
  // All results since timestamp
  allScores = getResultsSince(sinceArg)
  const runIds = getRunIdsSince(sinceArg)
  console.log(`Loaded ${allScores.length} results from ${runIds.length} run_ids since ${sinceArg}`)
} else {
  // Default: get the latest batch by finding all run_ids from the last 2 hours
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
  allScores = getResultsSince(twoHoursAgo)
  const runIds = getRunIdsSince(twoHoursAgo)
  if (allScores.length === 0) {
    console.error('No results found in the last 2 hours. Use --since or --run-ids to specify.')
    process.exit(1)
  }
  console.log(
    `Loaded ${allScores.length} results from ${runIds.length} run_ids (last 2 hours)\n  Run IDs: ${runIds.join(', ')}`,
  )
}

// Group by mode based on label suffix
type Mode = 'baseline' | 'mcp' | 'skills'

function inferMode(score: DBScore): Mode {
  if (score.label.endsWith(' (MCP)')) return 'mcp'
  if (score.label.endsWith(' (Skills)')) return 'skills'
  return 'baseline'
}

const byMode = new Map<Mode, DBScore[]>()
for (const score of allScores) {
  const mode = inferMode(score)
  if (!byMode.has(mode)) byMode.set(mode, [])
  byMode.get(mode)?.push(score)
}

// Report each mode as a single consolidated experiment
const batchRunId = `batch-${new Date().toISOString().replace(/[:.]/g, '-')}`

for (const [mode, scores] of byMode) {
  const entries: BraintrustEntry[] = scores.map((score) => ({
    ...score,
    evaluationPath: score.evaluationPath ?? '',
  }))

  const models = [...new Set(scores.map((s) => s.model))]
  const categories = [...new Set(scores.map((s) => s.category))]

  console.log(
    `\nReporting ${mode}: ${entries.length} results (${models.length} models x ${categories.length} categories)`,
  )

  await braintrustReporter(entries, batchRunId, mode)
}

console.log('\nDone! Check Braintrust for consolidated experiments.')
