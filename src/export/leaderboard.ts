/**
 * Cross-agent leaderboard export.
 *
 * Reads agent-scores.json files from multiple runs and produces
 * a unified leaderboard.json for cross-agent comparison.
 *
 * Inspired by next-evals-oss export-results.ts pattern.
 *
 * Usage:
 *   bun src/export/leaderboard.ts
 *   bun src/export/leaderboard.ts --since 2026-03-24
 */
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { getResults, getRunIdsSince, initDB } from '@/src/db'
import type { Score } from '@/src/interfaces'
import { computeSkillsImpact, type SkillsImpact } from './skills-impact'

type AgentExperiment = {
  agent: string
  label: string
  totalEvals: number
  passed: number
  passRate: number
  meanScore: number
  skillsImpact?: SkillsImpact
}

type EvalResult = {
  evalKey: string
  framework: string
  category: string
  score: number
  evaluationPath?: string
}

type LeaderboardData = {
  metadata: {
    exportedAt: string
    experiments: AgentExperiment[]
  }
  results: Record<string, EvalResult[]>
}

const { values } = parseArgs({
  args: Bun.argv,
  options: {
    since: { type: 'string' },
  },
  strict: true,
  allowPositionals: true,
})

initDB()

const since = values.since ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
const runIds = getRunIdsSince(since)

if (runIds.length === 0) {
  console.error(`No runs found since ${since}`)
  process.exit(1)
}

console.log(`Found ${runIds.length} runs since ${since}`)

// Group runs by agent mode (e.g., "agent-claude-code", "agent-codex-skills-mcp")
const runsByMode = new Map<string, string[]>()
for (const runId of runIds) {
  // Extract mode from runId: agent-{type}[-skills][-mcp]-{timestamp}
  const parts = runId.split('-')
  const timestampIdx = parts.findIndex((p) => /^\d{4}$/.test(p))
  const mode = timestampIdx > 0 ? parts.slice(0, timestampIdx).join('-') : runId
  if (!runsByMode.has(mode)) runsByMode.set(mode, [])
  runsByMode.get(mode)?.push(runId)
}

const leaderboard: LeaderboardData = {
  metadata: {
    exportedAt: new Date().toISOString(),
    experiments: [],
  },
  results: {},
}

// Process each mode
for (const [mode, modeRunIds] of runsByMode) {
  // Get the latest run for this mode
  const latestRunId = modeRunIds[modeRunIds.length - 1]
  const scores = getResults(latestRunId)

  if (scores.length === 0) continue

  const passed = scores.filter((s) => s.value >= 0.5).length
  const meanScore = scores.reduce((sum, s) => sum + s.value, 0) / scores.length

  // Determine agent label from scores
  const label = scores[0]?.label ?? mode

  const experiment: AgentExperiment = {
    agent: mode,
    label,
    totalEvals: scores.length,
    passed,
    passRate: Math.round((passed / scores.length) * 100),
    meanScore: Math.round(meanScore * 100) / 100,
  }

  // Check for skills impact (compare base vs skills runs)
  const baseMode = mode.replace('-skills', '').replace('-mcp', '')
  const skillsMode = `${baseMode}-skills`
  if (mode === skillsMode && runsByMode.has(baseMode)) {
    const baseRunIds = runsByMode.get(baseMode)
    if (!baseRunIds) continue
    const baseScores = getResults(baseRunIds[baseRunIds.length - 1])
    if (baseScores.length > 0) {
      experiment.skillsImpact = computeSkillsImpact(baseScores, scores)
    }
  }

  leaderboard.metadata.experiments.push(experiment)

  leaderboard.results[mode] = scores.map((s) => ({
    evalKey: `${s.framework}/${s.category}`,
    framework: s.framework,
    category: s.category,
    score: s.value,
    evaluationPath: (s as Score & { evaluationPath?: string }).evaluationPath,
  }))
}

// Sort experiments by passRate descending
leaderboard.metadata.experiments.sort((a, b) => b.passRate - a.passRate)

const outputPath = path.join(process.cwd(), 'leaderboard.json')
await writeFile(outputPath, JSON.stringify(leaderboard, null, 2))

console.log(`\n${'-'.repeat(60)}`)
console.log('Leaderboard Export')
console.log('-'.repeat(60))
for (const exp of leaderboard.metadata.experiments) {
  const skillsDelta = exp.skillsImpact ? ` (skills: +${exp.skillsImpact.delta}%)` : ''
  console.log(
    `  ${exp.label}: ${exp.passRate}% pass (${exp.passed}/${exp.totalEvals})${skillsDelta}`,
  )
}
console.log('-'.repeat(60))
console.log(`Exported to: ${outputPath}`)
