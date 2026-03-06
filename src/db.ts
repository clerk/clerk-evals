import { Database } from 'bun:sqlite'
import type { Score } from '@/src/interfaces'

const db = new Database('evals.db', { create: true })
db.run('PRAGMA journal_mode = WAL')
db.run('PRAGMA synchronous = NORMAL')

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

  // Migrations: add token/cost/duration columns
  const cols = db.query('PRAGMA table_info(results)').all() as { name: string }[]
  const colNames = new Set(cols.map((c) => c.name))
  if (!colNames.has('tokens_in')) {
    db.run('ALTER TABLE results ADD COLUMN tokens_in INTEGER')
    db.run('ALTER TABLE results ADD COLUMN tokens_out INTEGER')
    db.run('ALTER TABLE results ADD COLUMN cost_usd REAL')
    db.run('ALTER TABLE results ADD COLUMN duration_ms INTEGER')
  }

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
    INSERT INTO results (run_id, model, label, framework, category, value, timestamp, tokens_in, tokens_out, cost_usd, duration_ms)
    VALUES ($run_id, $model, $label, $framework, $category, $value, $timestamp, $tokens_in, $tokens_out, $cost_usd, $duration_ms)
  `)

  query.run({
    $run_id: runId,
    $model: score.model,
    $label: score.label,
    $framework: score.framework,
    $category: score.category,
    $value: score.value,
    $timestamp: score.updatedAt ?? new Date().toISOString(),
    $tokens_in: score.tokens?.promptTokens ?? null,
    $tokens_out: score.tokens?.completionTokens ?? null,
    $cost_usd: score.costUsd ?? null,
    $duration_ms: score.durationMs ?? null,
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
    'SELECT model, label, framework, category, value, timestamp as updatedAt, tokens_in, tokens_out, cost_usd, duration_ms as durationMs FROM results'
  if (runId) {
    queryStr += ' WHERE run_id = $run_id'
  }
  queryStr += ' ORDER BY timestamp DESC'

  const query = db.query(queryStr)
  const results = runId ? query.all({ $run_id: runId }) : query.all()

  return (results as Array<Record<string, unknown>>).map((r) => ({
    model: r.model as string,
    label: r.label as string,
    framework: r.framework as Score['framework'],
    category: r.category as Score['category'],
    value: r.value as number,
    updatedAt: r.updatedAt as string | undefined,
    ...(r.tokens_in != null && {
      tokens: {
        promptTokens: r.tokens_in as number,
        completionTokens: r.tokens_out as number,
        totalTokens: (r.tokens_in as number) + (r.tokens_out as number),
      },
    }),
    ...(r.cost_usd != null && { costUsd: r.cost_usd as number }),
    ...(r.durationMs != null && { durationMs: r.durationMs as number }),
  }))
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
