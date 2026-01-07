/**
 * Merge baseline scores with MCP scores into enhanced format for llm-leaderboard
 *
 * Usage: bun run merge-scores
 *
 * Input:
 *   - scores.json (baseline)
 *   - scores-mcp.json (MCP)
 *
 * Output:
 *   - llm-scores.json (enhanced format for clerk.com)
 */

import fs from 'node:fs'
import type { Score } from '@/src/interfaces'

type Provider = 'anthropic' | 'openai' | 'google' | 'vercel'

type EnhancedScore = Score & {
  provider: Provider
  mcpScore?: number
  improvement?: number
  toolsUsed?: string[]
}

const MODEL_PROVIDERS: Record<string, Provider> = {
  'gpt-4o': 'openai',
  'gpt-5': 'openai',
  'gpt-5-chat-latest': 'openai',
  'claude-sonnet-4-0': 'anthropic',
  'claude-sonnet-4-5': 'anthropic',
  'claude-opus-4-0': 'anthropic',
  'claude-opus-4-5': 'anthropic',
  'claude-haiku-4-5': 'anthropic',
  'v0-1.5-md': 'vercel',
  'gemini-2.5-flash': 'google',
  'gemini-3-pro-preview': 'google',
}

function getProvider(model: string): Provider {
  return MODEL_PROVIDERS[model] || 'openai'
}

function loadScores(filename: string): Score[] {
  if (!fs.existsSync(filename)) {
    console.warn(`Warning: ${filename} not found, using empty array`)
    return []
  }
  return JSON.parse(fs.readFileSync(filename, 'utf-8'))
}

function mergeScores(baseline: Score[], mcp: Score[]): EnhancedScore[] {
  const enhanced: EnhancedScore[] = []

  // Create lookup map for MCP scores
  const mcpMap = new Map<string, Score>()
  for (const score of mcp) {
    const key = `${score.model}:${score.category}:${score.framework}`
    mcpMap.set(key, score)
  }

  // Merge baseline with MCP
  for (const b of baseline) {
    const key = `${b.model}:${b.category}:${b.framework}`
    const m = mcpMap.get(key)

    const entry: EnhancedScore = {
      ...b,
      provider: getProvider(b.model),
    }

    if (m) {
      entry.mcpScore = m.value
      entry.improvement = m.value - b.value
      entry.toolsUsed = [] // TODO: extract from debug data if needed
      mcpMap.delete(key) // Mark as processed
    }

    enhanced.push(entry)
  }

  // Add MCP-only scores (models not in baseline)
  for (const [, m] of mcpMap) {
    enhanced.push({
      ...m,
      label: m.label.replace(' (MCP)', ''), // Clean up label
      provider: getProvider(m.model),
      mcpScore: m.value,
      value: 0, // No baseline
      improvement: m.value,
      toolsUsed: [],
    })
  }

  return enhanced
}

// Main
const baseline = loadScores('scores.json')
const mcp = loadScores('scores-mcp.json')

console.log(`Loaded ${baseline.length} baseline scores`)
console.log(`Loaded ${mcp.length} MCP scores`)

const enhanced = mergeScores(baseline, mcp)

fs.writeFileSync('llm-scores.json', JSON.stringify(enhanced, null, 2))
console.log(`Written ${enhanced.length} enhanced scores to llm-scores.json`)
