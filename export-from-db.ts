import { Database } from 'bun:sqlite'
import fs from 'node:fs'

const db = new Database('evals.db')

interface DBRow {
  model: string
  label: string
  framework: string
  category: string
  value: number
  updatedAt: string
}

interface Score {
  model: string
  label: string
  framework: string
  category: string
  value: number
  updatedAt: string
}

// Get BASELINE results (average of latest run per model+category)
// 1. Find the latest run_id for each model (baseline)
// 2. Average all eval scores from that run
const baselineQuery = db.query(`
  SELECT
    r.model,
    r.label,
    r.framework,
    r.category,
    AVG(r.value) as value,
    MAX(r.timestamp) as updatedAt
  FROM results r
  INNER JOIN (
    SELECT model, MAX(run_id) as latest_run
    FROM results
    WHERE label NOT LIKE '%(MCP)%'
    GROUP BY model
  ) latest ON r.model = latest.model AND r.run_id = latest.latest_run
  WHERE r.label NOT LIKE '%(MCP)%'
  GROUP BY r.model, r.category
`)

const baseline = baselineQuery.all() as DBRow[]
console.log(`Baseline scores: ${baseline.length}`)

// Get MCP results (average of latest run per model+category)
const mcpQuery = db.query(`
  SELECT
    r.model,
    r.label,
    r.framework,
    r.category,
    AVG(r.value) as value,
    MAX(r.timestamp) as updatedAt
  FROM results r
  INNER JOIN (
    SELECT model, MAX(run_id) as latest_run
    FROM results
    WHERE label LIKE '%(MCP)%'
    GROUP BY model
  ) latest ON r.model = latest.model AND r.run_id = latest.latest_run
  WHERE r.label LIKE '%(MCP)%'
  GROUP BY r.model, r.category
`)

const mcp = mcpQuery.all() as DBRow[]
console.log(`MCP scores: ${mcp.length}`)

// Show breakdown by model
console.log('\nBaseline per model:')
const baselineCounts = new Map<string, number>()
for (const s of baseline) {
  const count = baselineCounts.get(s.label) || 0
  baselineCounts.set(s.label, count + 1)
}
for (const [model, count] of baselineCounts.entries()) {
  console.log(`  ${model}: ${count}/6 categories`)
}

console.log('\nMCP per model:')
const mcpCounts = new Map<string, number>()
for (const s of mcp) {
  const count = mcpCounts.get(s.label) || 0
  mcpCounts.set(s.label, count + 1)
}
for (const [model, count] of mcpCounts.entries()) {
  console.log(`  ${model}: ${count}/6 categories`)
}

fs.writeFileSync('scores.json', JSON.stringify(baseline, null, 2))
fs.writeFileSync('scores-mcp.json', JSON.stringify(mcp, null, 2))

console.log('\nExported to scores.json and scores-mcp.json')
