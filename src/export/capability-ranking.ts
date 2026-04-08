/**
 * Capability-based leaderboard from SQLite — no Braintrust needed.
 *
 * Slices scores by primaryCapability to show where each model
 * excels or struggles across behavioral dimensions.
 *
 * Usage:
 *   bun src/export/capability-ranking.ts
 *   bun src/export/capability-ranking.ts --since 2026-03-01
 *   bun src/export/capability-ranking.ts --mode mcp
 *   bun src/export/capability-ranking.ts --json
 */
import { parseArgs } from 'node:util'
import { EVALUATIONS } from '@/src/config'
import { getResults, getRunIdsSince, initDB } from '@/src/db'
import type { Capability, Score } from '@/src/interfaces'

const { values } = parseArgs({
  args: Bun.argv,
  options: {
    since: { type: 'string' },
    mode: { type: 'string', default: 'baseline' },
    json: { type: 'boolean', default: false },
  },
  strict: true,
  allowPositionals: true,
})

initDB()

const since = values.since ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
const mode = values.mode ?? 'baseline'

// Label suffix for each mode
const LABEL_SUFFIX: Record<string, string> = {
  baseline: '',
  mcp: ' (MCP)',
  skills: ' (Skills)',
}
const suffix = LABEL_SUFFIX[mode] ?? ''

// Get all runs since date
const runIds = getRunIdsSince(since)
if (runIds.length === 0) {
  console.error(`No runs found since ${since}`)
  process.exit(1)
}

// Gather all scores, filtering by mode via label suffix
const allScores: (Score & { evaluationPath?: string })[] = []
for (const runId of runIds) {
  const scores = getResults(runId)
  for (const s of scores) {
    if (mode === 'baseline' && !s.label.includes('(')) {
      allScores.push(s)
    } else if (mode !== 'baseline' && s.label.endsWith(suffix)) {
      allScores.push(s)
    }
  }
}

if (allScores.length === 0) {
  console.error(`No ${mode} scores found since ${since}`)
  process.exit(1)
}

// Deduplicate: keep latest score per model+eval
const deduped = new Map<string, (typeof allScores)[0]>()
for (const s of allScores) {
  const key = `${s.label}::${s.evaluationPath}`
  const existing = deduped.get(key)
  if (!existing || (s.updatedAt && existing.updatedAt && s.updatedAt > existing.updatedAt)) {
    deduped.set(key, s)
  }
}
const scores = [...deduped.values()]

// Build eval path -> primaryCapability lookup
const evalsByPath = new Map(EVALUATIONS.map((e) => [e.path, e]))

// All capabilities in display order
const ALL_CAPS: Capability[] = [
  'api_knowledge',
  'negative_constraint',
  'framework_detection',
  'ui_composition',
  'webhook_integration',
  'migration_reasoning',
]

const CAP_SHORT: Record<Capability, string> = {
  api_knowledge: 'API',
  negative_constraint: 'NegConst',
  framework_detection: 'FW Det',
  ui_composition: 'UI Comp',
  webhook_integration: 'Webhook',
  migration_reasoning: 'Migrate',
  tool_composition: 'Tools',
}

// Clean label (remove mode suffix)
function cleanLabel(label: string): string {
  return label.replace(/ \(MCP\)$/, '').replace(/ \(Skills\)$/, '')
}

// Group: model -> capability -> values[]
const modelCaps = new Map<string, Map<Capability, number[]>>()
for (const s of scores) {
  const evalDef = s.evaluationPath ? evalsByPath.get(s.evaluationPath) : undefined
  if (!evalDef) continue

  const primary = evalDef.primaryCapability
  const label = cleanLabel(s.label)

  let capMap = modelCaps.get(label)
  if (!capMap) {
    capMap = new Map()
    modelCaps.set(label, capMap)
  }
  let vals = capMap.get(primary)
  if (!vals) {
    vals = []
    capMap.set(primary, vals)
  }
  vals.push(s.value)
}

// Build rows
type RankingRow = {
  label: string
  avg: number
  evalCount: number
  caps: Record<Capability, number | null>
}

const rows: RankingRow[] = []
for (const [label, capMap] of modelCaps) {
  let totalSum = 0
  let totalCount = 0
  const caps = {} as Record<Capability, number | null>

  for (const c of ALL_CAPS) {
    const vals = capMap.get(c)
    if (vals && vals.length > 0) {
      const avg = vals.reduce((s, v) => s + v, 0) / vals.length
      caps[c] = Math.round(avg * 100)
      totalSum += vals.reduce((s, v) => s + v, 0)
      totalCount += vals.length
    } else {
      caps[c] = null
    }
  }

  rows.push({
    label,
    avg: totalCount > 0 ? Math.round((totalSum / totalCount) * 100) : 0,
    evalCount: totalCount,
    caps,
  })
}

rows.sort((a, b) => b.avg - a.avg)

// JSON output
if (values.json) {
  const coverage: Record<string, { scored: number; total: number; missing: string[] }> = {}
  for (const c of ALL_CAPS) {
    const evalPaths = EVALUATIONS.filter((e) => e.primaryCapability === c)
    const scoredPaths = evalPaths.filter((e) => scores.some((s) => s.evaluationPath === e.path))
    coverage[c] = {
      scored: scoredPaths.length,
      total: evalPaths.length,
      missing: evalPaths.filter((e) => !scoredPaths.includes(e)).map((e) => e.path),
    }
  }

  const output = {
    mode,
    since,
    totalScores: scores.length,
    models: rows.length,
    capabilities: ALL_CAPS,
    rows,
    coverage,
  }
  console.log(JSON.stringify(output, null, 2))
  process.exit(0)
}

// Table output
const isTTY = process.stdout.isTTY ?? false
const green = isTTY ? '\x1b[32m' : ''
const yellow = isTTY ? '\x1b[33m' : ''
const red = isTTY ? '\x1b[31m' : ''
const dim = isTTY ? '\x1b[2m' : ''
const bold = isTTY ? '\x1b[1m' : ''
const reset = isTTY ? '\x1b[0m' : ''

function colorPct(v: number | null): string {
  if (v == null) return `${dim}   -${reset}`
  const pct = `${v}%`
  if (v >= 80) return `${green}${pct.padStart(4)}${reset}`
  if (v >= 50) return `${yellow}${pct.padStart(4)}${reset}`
  return `${red}${pct.padStart(4)}${reset}`
}

const pad = (s: string, n: number) => s.padStart(n)
const padL = (s: string, n: number) => s.padEnd(n)

console.log(
  `\n${bold}Capability Ranking${reset} ${dim}(${mode}, since ${since.slice(0, 10)})${reset}\n`,
)

// Header
let header = `  ${padL('Model', 24)}  ${pad('Avg', 5)}  ${pad('#', 3)}`
for (const c of ALL_CAPS) header += `  ${pad(CAP_SHORT[c], 8)}`
console.log(`${dim}${header}${reset}`)
console.log(
  `${dim}  ${'─'.repeat(24)}  ${'─'.repeat(5)}  ${'─'.repeat(3)}${ALL_CAPS.map(() => `  ${'─'.repeat(8)}`).join('')}${reset}`,
)

for (const r of rows) {
  let line = `  ${padL(r.label, 24)}  ${colorPct(r.avg)}  ${pad(String(r.evalCount), 3)}`
  for (const c of ALL_CAPS) {
    line += `  ${pad(colorPct(r.caps[c]), isTTY ? 17 : 8)}`
  }
  console.log(line)
}

// Coverage
console.log(`\n${bold}Coverage${reset}\n`)
for (const c of ALL_CAPS) {
  const evalPaths = EVALUATIONS.filter((e) => e.primaryCapability === c)
  const scoredPaths = evalPaths.filter((e) => scores.some((s) => s.evaluationPath === e.path))
  const pct = evalPaths.length > 0 ? Math.round((scoredPaths.length / evalPaths.length) * 100) : 0
  const bar = '█'.repeat(Math.round(pct / 10)) + '░'.repeat(10 - Math.round(pct / 10))
  const color = pct === 100 ? green : pct > 0 ? yellow : red
  console.log(
    `  ${padL(CAP_SHORT[c], 10)} ${color}${bar}${reset} ${scoredPaths.length}/${evalPaths.length} evals`,
  )
}

// Missing evals
const missingEvals = EVALUATIONS.filter((e) => !scores.some((s) => s.evaluationPath === e.path))
if (missingEvals.length > 0) {
  console.log(
    `\n${bold}Missing evals${reset} ${dim}(${missingEvals.length} not yet scored)${reset}\n`,
  )
  const byCap = new Map<Capability, string[]>()
  for (const e of missingEvals) {
    let paths = byCap.get(e.primaryCapability)
    if (!paths) {
      paths = []
      byCap.set(e.primaryCapability, paths)
    }
    paths.push(e.path)
  }
  for (const [cap, paths] of byCap) {
    console.log(`  ${dim}${CAP_SHORT[cap]}:${reset}`)
    for (const p of paths) console.log(`    ${dim}- ${p}${reset}`)
  }
}

// Suggest command to fill gaps
if (missingEvals.length > 0) {
  // Find which category has most missing
  const missingCaps = [...new Set(missingEvals.map((e) => e.primaryCapability))]
  const biggestGap = missingCaps.sort(
    (a, b) =>
      missingEvals.filter((e) => e.primaryCapability === b).length -
      missingEvals.filter((e) => e.primaryCapability === a).length,
  )[0]
  const sampleEval = missingEvals.find((e) => e.primaryCapability === biggestGap)
  if (sampleEval) {
    console.log(
      `\n${dim}Fill gaps: bun start --eval "${sampleEval.path.replace('evals/', '')}" --smoke${reset}`,
    )
  }
}

console.log()
