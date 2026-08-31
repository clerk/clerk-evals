/**
 * Merge baseline scores with MCP and Skills scores into enhanced format for llm-leaderboard.
 *
 * When per-eval identity is available, MCP/Skills columns are only emitted for exact
 * eval coverage. This prevents partial reruns from being published as category-wide scores.
 */

import fs from 'node:fs'
import { EVALUATIONS, MODELS } from '@/src/config'
import { getEvalKey } from '@/src/eval-identity'
import type { Score } from '@/src/interfaces'
import type { Provider } from '@/src/providers'

type EnhancedScore = Score & {
  provider: Provider
  mcpScore?: number
  improvement?: number
  skillsScore?: number
  skillsImprovement?: number
  toolsUsed?: string[]
  evalsRun?: number
  mcpCoverage?: string
  skillsCoverage?: string
  provenance?: {
    baseRunIds?: string[]
    mcpRunIds?: string[]
    skillsRunIds?: string[]
    evalKeys: string[]
  }
}

type FileScore = Score & { evaluationPath?: string; runId?: string }

/** Lookup provider from model name using MODELS config */
function getProvider(model: string): Provider {
  for (const [provider, models] of Object.entries(MODELS)) {
    if (models.some((m) => m.name === model)) {
      return provider as Provider
    }
  }
  return 'openai' // fallback
}

function loadScores(filename: string): FileScore[] {
  if (!fs.existsSync(filename)) {
    console.warn(`Warning: ${filename} not found, using empty array`)
    return []
  }
  return JSON.parse(fs.readFileSync(filename, 'utf-8'))
}

const evalsByPathFrameworkCategory = new Map(
  EVALUATIONS.map((e) => [`${e.path}:${e.framework}:${e.category}`, e]),
)

function getScoreEvalKey(score: FileScore): string | undefined {
  if (score.evalKey) return score.evalKey
  if (!score.evaluationPath) return undefined
  const evalDef = evalsByPathFrameworkCategory.get(
    `${score.evaluationPath}:${score.framework}:${score.category}`,
  )
  return evalDef ? getEvalKey(evalDef) : score.evaluationPath
}

function scoreCellKey(score: FileScore): string | undefined {
  const evalKey = getScoreEvalKey(score)
  if (!evalKey) return undefined
  return `${score.model}:${score.framework}:${evalKey}`
}

function compactUnique(values: Array<string | undefined>): string[] | undefined {
  const unique = [...new Set(values.filter((value): value is string => !!value))]
  return unique.length > 0 ? unique : undefined
}

function avgScore(scores: FileScore[]): number {
  return scores.reduce((sum, score) => sum + score.value, 0) / scores.length
}

function averageSkillsByCategory(skills: FileScore[]): Map<string, number> {
  const buckets = new Map<string, number[]>()
  for (const s of skills) {
    const key = `${s.model}:${s.category}:${s.framework}`
    const arr = buckets.get(key) ?? []
    arr.push(s.value)
    buckets.set(key, arr)
  }
  const averaged = new Map<string, number>()
  for (const [key, values] of buckets) {
    averaged.set(key, values.reduce((sum, v) => sum + v, 0) / values.length)
  }
  return averaged
}

function indexByCategory(scores: FileScore[]): Map<string, FileScore> {
  const map = new Map<string, FileScore>()
  for (const score of scores) {
    map.set(`${score.model}:${score.category}:${score.framework}`, score)
  }
  return map
}

function indexByCell(scores: FileScore[]): Map<string, FileScore> {
  const cells = new Map<string, FileScore>()
  for (const score of scores) {
    const key = scoreCellKey(score)
    if (!key) continue
    const existing = cells.get(key)
    if (
      !existing ||
      (score.updatedAt && existing.updatedAt && score.updatedAt > existing.updatedAt)
    ) {
      cells.set(key, score)
    }
  }
  return cells
}

export function mergeScores(
  baseline: FileScore[],
  mcp: FileScore[],
  skills: FileScore[],
): EnhancedScore[] {
  const enhanced: EnhancedScore[] = []
  const mcpCategoryMap = indexByCategory(mcp)
  const skillsCategoryMap = averageSkillsByCategory(skills)
  const mcpCells = indexByCell(mcp)
  const skillsCells = indexByCell(skills)

  const baselineBuckets = new Map<string, FileScore[]>()
  for (const score of baseline) {
    const key = `${score.model}:${score.category}:${score.framework}`
    const bucket = baselineBuckets.get(key) ?? []
    bucket.push(score)
    baselineBuckets.set(key, bucket)
  }

  for (const [key, bucket] of baselineBuckets) {
    const b = bucket[0]
    if (!b) continue

    const evalKeys = [
      ...new Set(bucket.map(getScoreEvalKey).filter((value): value is string => !!value)),
    ]
    const entry: EnhancedScore = {
      ...b,
      value: evalKeys.length > 0 ? avgScore(bucket) : b.value,
      provider: getProvider(b.model),
    }

    if (evalKeys.length === 0) {
      const m = mcpCategoryMap.get(key)
      const skillsAvg = skillsCategoryMap.get(key)

      if (m) {
        entry.mcpScore = m.value
        entry.improvement = m.value - b.value
        entry.toolsUsed = []
        mcpCategoryMap.delete(key)
      }

      if (skillsAvg !== undefined) {
        entry.skillsScore = skillsAvg
        entry.skillsImprovement = skillsAvg - b.value
      }

      enhanced.push(entry)
      continue
    }

    const mcpMatches = evalKeys
      .map((evalKey) => mcpCells.get(`${b.model}:${b.framework}:${evalKey}`))
      .filter((score): score is FileScore => !!score)
    const skillsMatches = evalKeys
      .map((evalKey) => skillsCells.get(`${b.model}:${b.framework}:${evalKey}`))
      .filter((score): score is FileScore => !!score)

    // Baseline has exact eval identity, so do not publish a legacy MCP-only
    // category row for the same model/category. Exact coverage decides below.
    mcpCategoryMap.delete(key)

    if (mcpMatches.length > 0 && mcpMatches.length < evalKeys.length) {
      console.warn(
        `[merge-scores] Partial MCP coverage for ${key}: ${mcpMatches.length}/${evalKeys.length}; omitting mcpScore`,
      )
    }
    if (skillsMatches.length > 0 && skillsMatches.length < evalKeys.length) {
      console.warn(
        `[merge-scores] Partial Skills coverage for ${key}: ${skillsMatches.length}/${evalKeys.length}; omitting skillsScore`,
      )
    }

    entry.evalsRun = evalKeys.length
    entry.provenance = {
      baseRunIds: compactUnique(bucket.map((score) => score.runId)),
      mcpRunIds: compactUnique(mcpMatches.map((score) => score.runId)),
      skillsRunIds: compactUnique(skillsMatches.map((score) => score.runId)),
      evalKeys,
    }

    if (mcpMatches.length === evalKeys.length) {
      const mcpScore = avgScore(mcpMatches)
      entry.mcpScore = mcpScore
      entry.improvement = mcpScore - entry.value
      entry.toolsUsed = []
    }
    entry.mcpCoverage = `${mcpMatches.length}/${evalKeys.length}`

    if (skillsMatches.length === evalKeys.length) {
      const skillsScore = avgScore(skillsMatches)
      entry.skillsScore = skillsScore
      entry.skillsImprovement = skillsScore - entry.value
    }
    entry.skillsCoverage = `${skillsMatches.length}/${evalKeys.length}`

    enhanced.push(entry)
  }

  for (const [, m] of mcpCategoryMap) {
    enhanced.push({
      ...m,
      label: m.label.replace(' (MCP)', ''),
      provider: getProvider(m.model),
      mcpScore: m.value,
      value: 0,
      improvement: m.value,
      toolsUsed: [],
    })
  }

  return enhanced
}

if (import.meta.main) {
  const baseline = loadScores('scores.json')
  const mcp = loadScores('scores-mcp.json')
  const skills = loadScores('scores-skills.json')

  console.log(`Loaded ${baseline.length} baseline scores`)
  console.log(`Loaded ${mcp.length} MCP scores`)
  console.log(`Loaded ${skills.length} Skills scores`)

  const enhanced = mergeScores(baseline, mcp, skills)

  fs.writeFileSync('llm-scores.json', JSON.stringify(enhanced, null, 2))
  console.log(`Written ${enhanced.length} enhanced scores to llm-scores.json`)
}
