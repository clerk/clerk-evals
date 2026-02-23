#!/usr/bin/env bun
import { Database } from 'bun:sqlite'

/**
 * Update Notion pages with new scores from latest run
 *
 * This script outputs the update commands needed for Notion MCP.
 * It reads the latest run from the database and generates update commands
 * for each model's page in Notion.
 */

const DATA_SOURCE_ID = '946a4520-ce1c-4ccf-b7ef-fa23ad22b5d6'
const db = new Database('evals.db')

// Get the latest run_id
const latestRun = db.query('SELECT run_id FROM results ORDER BY timestamp DESC LIMIT 1').get() as { run_id: string } | null

if (!latestRun) {
  console.error('❌ No results found in database')
  process.exit(1)
}

const runId = latestRun.run_id
console.log(`📊 Latest run: ${runId}\n`)

// Get average scores per model from the latest run
const results = db.query(`
  SELECT model, label, AVG(value) as avg_score
  FROM results
  WHERE run_id = $runId
  GROUP BY model, label
  ORDER BY model, label
`).all({ $runId: runId }) as Array<{ model: string, label: string, avg_score: number }>

console.log(`Found ${results.length} models to update:\n`)

// Map of model labels to their scores
const scoreMap = new Map<string, number>()
results.forEach(r => {
  scoreMap.set(r.label, r.avg_score)
  console.log(`  ${r.label}: ${(r.avg_score * 100).toFixed(1)}%`)
})

console.log('\n📋 Notion page IDs to update (from search results):')
console.log('You need to fetch each page and update with the score.\n')

// Page IDs from the search (these need to be mapped to model names)
const pageIds = [
  { id: '30f2b9ab-44fe-8100-856c-dd79edf527d1', title: 'GPT-5 Chat' },
  { id: '30f2b9ab-44fe-81b9-9fc5-ded1bfe1ad2c', title: 'GPT-5.2 Codex' },
  { id: '30f2b9ab-44fe-816c-ab4b-d163dfeded1a', title: 'GPT-5' },
  { id: '30f2b9ab-44fe-810f-9816-c3fbadb107f0', title: 'GPT-4o' },
  { id: '30f2b9ab-44fe-8134-944e-e073c0614131', title: 'Claude Opus 4' },
  { id: '30f2b9ab-44fe-8116-bb70-de81383c9439', title: 'Gemini 2.5 Flash' },
  { id: '30f2b9ab-44fe-8144-a308-d0818c66336a', title: 'Claude Haiku 4.5' },
  { id: '30f2b9ab-44fe-8128-a31f-d126d0ba766b', title: 'Gemini 3 Pro Preview' },
  { id: '30f2b9ab-44fe-8130-8418-f04316027cc7', title: 'Claude Opus 4.6' },
  // Note: Missing some models - need to fetch all pages from the database
]

console.log('\n💡 To update a page, use mcp__notion__notion-update-page with:')
console.log('  - page_id: <page-id>')
console.log('  - command: "update_properties"')
console.log('  - properties: { "Score - 02.22.26 Run": <score> }')
console.log('\nExample for GPT-5 Chat:')
console.log(JSON.stringify({
  page_id: '30f2b9ab-44fe-8100-856c-dd79edf527d1',
  command: 'update_properties',
  properties: {
    'Score - 02.22.26 Run': scoreMap.get('GPT-5 Chat')
  }
}, null, 2))
