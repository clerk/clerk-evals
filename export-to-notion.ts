#!/usr/bin/env bun
import { Database } from 'bun:sqlite'
import { parseArgs } from 'util'

/**
 * Export evaluation results to Notion
 *
 * This script prepares the data and outputs JSON that can be used with Notion MCP.
 * It supports two modes:
 * 1. Initial export: Creates new pages with Model, Category, Framework, Mode, etc.
 * 2. Score column update: Adds a new score column to existing database
 *
 * Database: LLM Eval Results (under Team Growth Homebase)
 * Data Source ID: 946a4520-ce1c-4ccf-b7ef-fa23ad22b5d6
 *
 * Usage:
 *   # Initial export (create new pages)
 *   bun export-to-notion.ts [run_id]
 *
 *   # Add custom score column
 *   bun export-to-notion.ts --add-score-column="Score - 02.21.26 Run" [--after="Model"]
 *
 * If no run_id provided, exports the latest run.
 */

const DATA_SOURCE_ID = '946a4520-ce1c-4ccf-b7ef-fa23ad22b5d6'
const db = new Database('evals.db')

interface Result {
  run_id: string
  model: string
  label: string
  framework: string
  category: string
  value: number
  timestamp: string
}

// Parse command line arguments
const args = process.argv.slice(2)
let addScoreColumn: string | null = null
let afterColumn: string | null = null
let targetRunId: string | undefined

for (let i = 0; i < args.length; i++) {
  const arg = args[i]
  if (arg.startsWith('--add-score-column=')) {
    addScoreColumn = arg.split('=')[1]
  } else if (arg.startsWith('--after=')) {
    afterColumn = arg.split('=')[1]
  } else if (!arg.startsWith('--')) {
    targetRunId = arg
  }
}

// MODE 1: Add custom score column to database
if (addScoreColumn) {
  console.log(`\n📊 Adding score column: "${addScoreColumn}"`)
  if (afterColumn) {
    console.log(`   Position: After "${afterColumn}"`)
  }

  const columnData = {
    data_source_id: DATA_SOURCE_ID,
    properties: {
      [addScoreColumn]: {
        type: 'number',
        number: {
          format: 'percent'
        }
      }
    }
  }

  console.log('\n📋 Column schema to add:')
  console.log(JSON.stringify(columnData, null, 2))
  console.log('\n💡 Use the Notion MCP update-data-source tool with this data')
  console.log('   Note: Column positioning must be done manually in Notion UI')
  process.exit(0)
}

// MODE 2: Export results (create new pages or update existing)
let runId: string

if (targetRunId) {
  runId = targetRunId
  console.log(`📊 Exporting run: ${runId}`)
} else {
  const latestRun = db.query('SELECT run_id FROM results ORDER BY timestamp DESC LIMIT 1').get() as { run_id: string } | null
  if (!latestRun) {
    console.error('❌ No results found in database')
    process.exit(1)
  }
  runId = latestRun.run_id
  console.log(`📊 Exporting latest run: ${runId}`)
}

// Get all results for this run
const results = db.query(`
  SELECT run_id, model, label, framework, category, value, timestamp
  FROM results
  WHERE run_id = $runId
  ORDER BY model, category
`).all({ $runId: runId }) as Result[]

if (results.length === 0) {
  console.error(`❌ No results found for run_id: ${runId}`)
  process.exit(1)
}

console.log(`\n✅ Found ${results.length} results to export\n`)

// Determine mode from label (if it contains MCP or Skills)
function determineMode(label: string): string {
  if (label.includes('(MCP)')) return 'MCP'
  if (label.includes('(Skills)')) return 'Skills'
  return 'Baseline'
}

// Convert results to Notion MCP format
const pages = results.map((result) => {
  const mode = determineMode(result.label)
  const modelName = result.label.replace(/ \((MCP|Skills)\)/, '') // Remove mode suffix
  const runDate = new Date(result.timestamp).toISOString().split('T')[0]

  return {
    properties: {
      'Model': modelName,
      'Category': result.category,
      'Framework': result.framework,
      'Score': result.value,
      'Mode': mode,
      'date:Run Date:start': runDate,
      'date:Run Date:is_datetime': 0,
      'Run ID': result.run_id
    }
  }
})

// Output the export data
const exportData = {
  parent: { data_source_id: DATA_SOURCE_ID },
  pages: pages
}

console.log('📋 Export data ready:')
console.log(JSON.stringify(exportData, null, 2))
console.log('\n🔗 Database URL: https://notion.so/2ceee44967aa44e9a6bc3e0dc98a49f8')
console.log('\n💡 To export to Notion, use this data with the Notion MCP create-pages tool')
