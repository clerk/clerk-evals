/**
 * Merge baseline scores with MCP and Skills scores into enhanced format for llm-leaderboard
 *
 * Usage: bun run merge-scores
 *
 * Input:
 *   - scores.json (baseline)
 *   - scores-mcp.json (MCP)
 *   - scores-skills.json (Skills)
 *
 * Output:
 *   - llm-scores.json (enhanced format for clerk.com)
 */

import fs from 'node:fs'
import { EVALUATIONS, MODELS } from '@/src/config'
import type { Capability, Score } from '@/src/interfaces'
import type { Provider } from '@/src/providers'

type EnhancedScore = Score & {
  provider: Provider
  mcpScore?: number
  improvement?: number
  skillsScore?: number
  skillsImprovement?: number
  toolsUsed?: string[]
  /** Average cost in USD across evals in this category */
  avgCostUsd?: number
  /** Average duration in ms across evals in this category */
  avgDurationMs?: number
  /** Average total tokens across evals in this category */
  avgTokensTotal?: number
  /** Average MCP cost in USD across evals in this category */
  mcpAvgCostUsd?: number
  /** Average MCP duration in ms across evals in this category */
  mcpAvgDurationMs?: number
  /** Primary capability of the eval (when single eval per row) */
  primaryCapability?: Capability
  /** Union of all capability tags from evals in this category */
  capabilities?: Capability[]
  /** Eval description (present when scores.json has evaluationPath) */
  description?: string
}

/** Score entry as serialized to scores.json — may include evaluationPath from DBScore */
type FileScore = Score & { evaluationPath?: string }

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

/** Build a lookup from evaluation path → EVALUATIONS config entry */
const evalsByPath = new Map(EVALUATIONS.map((e) => [e.path, e]))

/**
 * Average per-eval skills scores into per-category scores.
 * Skills runner outputs one score per eval, but we need one per model+category.
 */
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

/** Compute average of non-null values, or undefined if no values */
function avg(values: number[]): number | undefined {
  if (values.length === 0) return undefined
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

/**
 * Group per-eval scores by model:category:framework and compute:
 * - average cost, duration, tokens
 * - union of capabilities from EVALUATIONS config
 * - description (if single eval in bucket, use its description)
 */
function computeCategoryMeta(scores: FileScore[]) {
  const buckets = new Map<
    string,
    {
      costs: number[]
      durations: number[]
      tokens: number[]
      caps: Set<Capability>
      primaryCaps: Set<Capability>
      descs: string[]
    }
  >()

  for (const s of scores) {
    const key = `${s.model}:${s.category}:${s.framework}`
    let b = buckets.get(key)
    if (!b) {
      b = {
        costs: [],
        durations: [],
        tokens: [],
        caps: new Set(),
        primaryCaps: new Set(),
        descs: [],
      }
      buckets.set(key, b)
    }

    if (s.costUsd != null) b.costs.push(s.costUsd)
    if (s.durationMs != null) b.durations.push(s.durationMs)
    if (s.tokens?.totalTokens != null) b.tokens.push(s.tokens.totalTokens)

    // Look up capabilities from EVALUATIONS config
    const evalPath = s.evaluationPath
    if (evalPath) {
      const evalDef = evalsByPath.get(evalPath)
      if (evalDef) {
        b.primaryCaps.add(evalDef.primaryCapability)
        if (evalDef.capabilities) {
          for (const cap of evalDef.capabilities) b.caps.add(cap)
        }
        b.descs.push(evalDef.description)
      }
    }
  }

  return buckets
}

function mergeScores(
  baseline: FileScore[],
  mcp: FileScore[],
  skills: FileScore[],
): EnhancedScore[] {
  const enhanced: EnhancedScore[] = []

  // Create lookup map for MCP scores (keyed by model:category:framework)
  const mcpMap = new Map<string, FileScore>()
  for (const score of mcp) {
    const key = `${score.model}:${score.category}:${score.framework}`
    mcpMap.set(key, score)
  }

  // Compute per-category efficiency metadata
  const baselineMeta = computeCategoryMeta(baseline)
  const mcpMeta = computeCategoryMeta(mcp)

  // Average skills scores by category
  const skillsMap = averageSkillsByCategory(skills)

  // Track which baseline keys we've already processed (scores.json may have per-eval rows)
  const seen = new Set<string>()

  // Merge baseline with MCP and Skills
  for (const b of baseline) {
    const key = `${b.model}:${b.category}:${b.framework}`
    // Deduplicate: if multiple per-eval rows share the same key, only emit one enhanced entry
    if (seen.has(key)) continue
    seen.add(key)

    const m = mcpMap.get(key)
    const skillsAvg = skillsMap.get(key)
    const bMeta = baselineMeta.get(key)
    const mMeta = mcpMeta.get(key)

    const entry: EnhancedScore = {
      ...b,
      provider: getProvider(b.model),
    }

    // Efficiency metrics + capabilities from baseline
    if (bMeta) {
      entry.avgCostUsd = avg(bMeta.costs)
      entry.avgDurationMs = avg(bMeta.durations)
      entry.avgTokensTotal = avg(bMeta.tokens)
      if (bMeta.primaryCaps.size === 1) entry.primaryCapability = [...bMeta.primaryCaps][0]
      if (bMeta.caps.size > 0) entry.capabilities = [...bMeta.caps]
      if (bMeta.descs.length === 1) entry.description = bMeta.descs[0]
    }

    if (m) {
      entry.mcpScore = m.value
      entry.improvement = m.value - b.value
      entry.toolsUsed = []
      // MCP efficiency metrics
      if (mMeta) {
        entry.mcpAvgCostUsd = avg(mMeta.costs)
        entry.mcpAvgDurationMs = avg(mMeta.durations)
      }
      mcpMap.delete(key)
    }

    if (skillsAvg !== undefined) {
      entry.skillsScore = skillsAvg
      entry.skillsImprovement = skillsAvg - b.value
    }

    enhanced.push(entry)
  }

  // Add MCP-only scores (models not in baseline)
  for (const [key, m] of mcpMap) {
    const mMeta = mcpMeta.get(key)
    const entry: EnhancedScore = {
      ...m,
      label: m.label.replace(' (MCP)', ''),
      provider: getProvider(m.model),
      mcpScore: m.value,
      value: 0,
      improvement: m.value,
      toolsUsed: [],
    }
    if (mMeta) {
      entry.mcpAvgCostUsd = avg(mMeta.costs)
      entry.mcpAvgDurationMs = avg(mMeta.durations)
      if (mMeta.primaryCaps.size === 1) entry.primaryCapability = [...mMeta.primaryCaps][0]
      if (mMeta.caps.size > 0) entry.capabilities = [...mMeta.caps]
    }
    enhanced.push(entry)
  }

  return enhanced
}

// Main
const baseline = loadScores('scores.json')
const mcp = loadScores('scores-mcp.json')
const skills = loadScores('scores-skills.json')

console.log(`Loaded ${baseline.length} baseline scores`)
console.log(`Loaded ${mcp.length} MCP scores`)
console.log(`Loaded ${skills.length} Skills scores`)

const enhanced = mergeScores(baseline, mcp, skills)

fs.writeFileSync('llm-scores.json', JSON.stringify(enhanced, null, 2))
console.log(`Written ${enhanced.length} enhanced scores to llm-scores.json`)
