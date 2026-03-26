/**
 * Skills impact analysis.
 *
 * Compares baseline agent scores vs skills-enhanced scores
 * to quantify the ROI of Clerk skills/MCP per agent.
 *
 * Inspired by next-evals-oss docsImpact pattern (AGENTS.md variants).
 */
import type { Score } from '@/src/interfaces'

export type SkillsImpact = {
  baseSuccessRate: number
  skillsSuccessRate: number
  delta: number
  newlyPassed: string[]
  newlyFailed: string[]
}

/**
 * Compute skills impact by comparing base and enhanced score sets.
 * A score >= 0.5 is considered "passed".
 */
export function computeSkillsImpact(baseScores: Score[], enhancedScores: Score[]): SkillsImpact {
  const baseMap = new Map<string, number>()
  const enhancedMap = new Map<string, number>()

  for (const s of baseScores) {
    const key = `${s.framework}/${s.category}`
    baseMap.set(key, s.value)
  }
  for (const s of enhancedScores) {
    const key = `${s.framework}/${s.category}`
    enhancedMap.set(key, s.value)
  }

  const basePassCount = [...baseMap.values()].filter((v) => v >= 0.5).length
  const enhancedPassCount = [...enhancedMap.values()].filter((v) => v >= 0.5).length

  const baseRate = baseMap.size > 0 ? (basePassCount / baseMap.size) * 100 : 0
  const enhancedRate = enhancedMap.size > 0 ? (enhancedPassCount / enhancedMap.size) * 100 : 0

  // Find evals that flipped
  const newlyPassed: string[] = []
  const newlyFailed: string[] = []

  for (const [key, enhancedScore] of enhancedMap) {
    const baseScore = baseMap.get(key)
    if (baseScore != null) {
      if (baseScore < 0.5 && enhancedScore >= 0.5) newlyPassed.push(key)
      if (baseScore >= 0.5 && enhancedScore < 0.5) newlyFailed.push(key)
    }
  }

  return {
    baseSuccessRate: Math.round(baseRate),
    skillsSuccessRate: Math.round(enhancedRate),
    delta: Math.round(enhancedRate - baseRate),
    newlyPassed,
    newlyFailed,
  }
}
