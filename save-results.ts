#!/usr/bin/env bun
import { Database } from 'bun:sqlite'
import fs from 'node:fs'
import path from 'node:path'

/**
 * Save evaluation results as a versioned snapshot
 *
 * Usage:
 *   bun save-results.ts [description]
 *
 * Example:
 *   bun save-results.ts "baseline nextjs quickstarts"
 *   bun save-results.ts "mcp with new prompts"
 *
 * Results are saved to results/ directory with format:
 *   YYYY-MM-DD_description.json
 */

const db = new Database('evals.db')

// Get the latest run
const latestRun = db.query('SELECT run_id FROM results ORDER BY timestamp DESC LIMIT 1').get() as { run_id: string } | null

if (!latestRun) {
  console.error('❌ No results found in database')
  process.exit(1)
}

const runId = latestRun.run_id

// Get all results for this run
const results = db.query(`
  SELECT model, label, framework, category, value, timestamp as updatedAt
  FROM results
  WHERE run_id = $runId
  ORDER BY model, category
`).all({ $runId: runId })

console.log(`📊 Found ${results.length} results from run: ${runId}`)

// Get description from command line or use generic name
const description = process.argv.slice(2).join(' ') || 'results'
const sanitizedDescription = description
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

// Create filename with date
const date = new Date().toISOString().split('T')[0]
const filename = `${date}_${sanitizedDescription}.json`
const filepath = path.join('results', filename)

// Ensure results directory exists
if (!fs.existsSync('results')) {
  fs.mkdirSync('results', { recursive: true })
}

// Save the results
fs.writeFileSync(filepath, JSON.stringify(results, null, 2))

console.log(`\n✅ Results saved to: ${filepath}`)

// Also save metadata about this run
const metadataPath = path.join('results', `${date}_${sanitizedDescription}_metadata.json`)
const metadata = {
  run_id: runId,
  description,
  timestamp: new Date().toISOString(),
  git_commit: await getGitCommit(),
  git_branch: await getGitBranch(),
  result_count: results.length
}

fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2))
console.log(`📝 Metadata saved to: ${metadataPath}`)

// Helper functions
async function getGitCommit(): Promise<string | null> {
  try {
    const proc = Bun.spawn(['git', 'rev-parse', 'HEAD'])
    const output = await new Response(proc.stdout).text()
    return output.trim()
  } catch {
    return null
  }
}

async function getGitBranch(): Promise<string | null> {
  try {
    const proc = Bun.spawn(['git', 'rev-parse', '--abbrev-ref', 'HEAD'])
    const output = await new Response(proc.stdout).text()
    return output.trim()
  } catch {
    return null
  }
}
