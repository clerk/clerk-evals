import { getResultsSince, getRun, initDB, type DBScore, type RunMetadata } from '@/src/db'
import fileReporter from '@/src/reporters/file'

const OUTPUT_FILES: Record<string, string> = {
  baseline: 'scores.json',
  mcp: 'scores-mcp.json',
  skills: 'scores-skills.json',
  'skills-mcp': 'scores-skills-mcp.json',
}

export function selectLatestScores(
  scores: DBScore[],
  runs: Map<string, RunMetadata>,
  anchor: RunMetadata,
): DBScore[] {
  const allowedModels = new Set(anchor.models)
  const allowedEvalKeys = new Set(anchor.evalKeys)
  const latest = new Map<string, DBScore>()

  for (const score of scores) {
    if (!score.runId || !score.evalKey) continue
    const run = runs.get(score.runId)
    if (!run || run.mode !== anchor.mode) continue
    if (!allowedModels.has(score.model) || !allowedEvalKeys.has(score.evalKey)) continue

    const key = `${score.model}:${score.framework}:${score.evalKey}`
    const existing = latest.get(key)
    if (!existing || (score.updatedAt ?? '') > (existing.updatedAt ?? '')) {
      latest.set(key, score)
    }
  }

  return [...latest.values()].sort((left, right) => {
    const leftKey = `${left.model}:${left.framework}:${left.evalKey}`
    const rightKey = `${right.model}:${right.framework}:${right.evalKey}`
    return leftKey.localeCompare(rightKey)
  })
}

if (import.meta.main) {
  const anchorRunId = Bun.argv[2]
  if (!anchorRunId) {
    console.error('Usage: bun rebuild:scores <anchor-run-id>')
    process.exit(1)
  }

  initDB()
  const anchor = getRun(anchorRunId)
  if (!anchor) {
    console.error(`Run not found: ${anchorRunId}`)
    process.exit(1)
  }

  const outputFile = OUTPUT_FILES[anchor.mode]
  if (!outputFile) {
    console.error(`Unsupported run mode: ${anchor.mode}`)
    process.exit(1)
  }

  const scores = getResultsSince(anchor.createdAt ?? '')
  const runIds = new Set(
    scores.map((score) => score.runId).filter((value): value is string => !!value),
  )
  const runs = new Map(
    [...runIds]
      .map((runId) => getRun(runId))
      .filter((run): run is RunMetadata => run !== undefined)
      .map((run) => [run.runId, run]),
  )
  const selected = selectLatestScores(scores, runs, anchor)
  const expected = anchor.models.length * anchor.evalKeys.length

  fileReporter(selected, outputFile)
  console.log(
    `Rebuilt ${outputFile} with ${selected.length}/${expected} exact ${anchor.mode} cells since ${anchor.createdAt}.`,
  )
}
