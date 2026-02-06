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
import { MODELS } from '@/src/config'
import type { Score } from '@/src/interfaces'
import type { Provider } from '@/src/providers'

type EnhancedScore = Score & {
  provider: Provider
  mcpScore?: number
  improvement?: number
  skillsScore?: number
  skillsImprovement?: number
  toolsUsed?: string[]
}

/** Lookup provider from model name using MODELS config */
function getProvider(model: string): Provider {
  for (const [provider, models] of Object.entries(MODELS)) {
    if (models.some((m) => m.name === model)) {
      return provider as Provider
    }
  }
  return 'openai' // fallback
}

function loadScores(filename: string): Score[] {
  if (!fs.existsSync(filename)) {
    console.warn(`Warning: ${filename} not found, using empty array`)
    return []
  }
  return JSON.parse(fs.readFileSync(filename, 'utf-8'))
}

/**
 * Average per-eval skills scores into per-category scores.
 * Skills runner outputs one score per eval, but we need one per model+category.
 */
function averageSkillsByCategory(skills: Score[]): Map<string, number> {
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

function mergeScores(baseline: Score[], mcp: Score[], skills: Score[]): EnhancedScore[] {
  const enhanced: EnhancedScore[] = []

  // Create lookup map for MCP scores
  const mcpMap = new Map<string, Score>()
  for (const score of mcp) {
    const key = `${score.model}:${score.category}:${score.framework}`
    mcpMap.set(key, score)
  }

  // Average skills scores by category
  const skillsMap = averageSkillsByCategory(skills)

  // Merge baseline with MCP and Skills
  for (const b of baseline) {
    const key = `${b.model}:${b.category}:${b.framework}`
    const m = mcpMap.get(key)
    const skillsAvg = skillsMap.get(key)

    const entry: EnhancedScore = {
      ...b,
      provider: getProvider(b.model),
    }

    if (m) {
      entry.mcpScore = m.value
      entry.improvement = m.value - b.value
      entry.toolsUsed = []
      mcpMap.delete(key)
    }

    if (skillsAvg !== undefined) {
      entry.skillsScore = skillsAvg
      entry.skillsImprovement = skillsAvg - b.value
    }

    enhanced.push(entry)
  }

  // Add MCP-only scores (models not in baseline)
  for (const [, m] of mcpMap) {
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
