import { Database } from 'bun:sqlite'
import type { Score } from '@/src/interfaces'

const db = new Database('evals.db')

export function initDB() {
  db.run(`
    CREATE TABLE IF NOT EXISTS results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id TEXT NOT NULL,
      model TEXT NOT NULL,
      label TEXT NOT NULL,
      framework TEXT NOT NULL,
      category TEXT NOT NULL,
      value REAL NOT NULL,
      timestamp TEXT NOT NULL
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS errors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id TEXT NOT NULL,
      model TEXT NOT NULL,
      label TEXT,
      framework TEXT,
      category TEXT,
      evaluation_path TEXT NOT NULL,
      error_message TEXT NOT NULL,
      stack_trace TEXT,
      timestamp TEXT NOT NULL
    )
  `)
}

export function saveResult(runId: string, score: Score) {
  const query = db.query(`
    INSERT INTO results (run_id, model, label, framework, category, value, timestamp)
    VALUES ($run_id, $model, $label, $framework, $category, $value, $timestamp)
  `)

  query.run({
    $run_id: runId,
    $model: score.model,
    $label: score.label,
    $framework: score.framework,
    $category: score.category,
    $value: score.value,
    $timestamp: score.updatedAt ?? new Date().toISOString(),
  })
}

export function saveError(
  runId: string,
  details: {
    model: string
    label?: string
    framework?: string
    category?: string
    evaluationPath: string
    error: unknown
  },
) {
  const query = db.query(`
    INSERT INTO errors (run_id, model, label, framework, category, evaluation_path, error_message, stack_trace, timestamp)
    VALUES ($run_id, $model, $label, $framework, $category, $evaluation_path, $error_message, $stack_trace, $timestamp)
  `)

  const errorObj = details.error instanceof Error ? details.error : new Error(String(details.error))

  query.run({
    $run_id: runId,
    $model: details.model,
    $label: details.label ?? null,
    $framework: details.framework ?? null,
    $category: details.category ?? null,
    $evaluation_path: details.evaluationPath,
    $error_message: errorObj.message,
    $stack_trace: errorObj.stack ?? null,
    $timestamp: new Date().toISOString(),
  })
}

export function getResults(runId?: string): Score[] {
  let queryStr =
    'SELECT model, label, framework, category, value, timestamp as updatedAt FROM results'
  if (runId) {
    queryStr += ' WHERE run_id = $run_id'
  }
  queryStr += ' ORDER BY timestamp DESC'

  const query = db.query(queryStr)
  const results = runId ? query.all({ $run_id: runId }) : query.all()

  return results as Score[]
}

export function getLatestResults(): Score[] {
  // Get the distinct list of evaluations (model + framework + category)
  // and return the most recent one for each.
  // This is a bit complex, for now let's just return the last run's data
  // or we can select the most recent run_id.

  const lastRun = db.query('SELECT run_id FROM results ORDER BY id DESC LIMIT 1').get() as {
    run_id: string
  } | null
  if (!lastRun) return []

  return getResults(lastRun.run_id)
}
