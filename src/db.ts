import { Database } from 'bun:sqlite'
import type { Score } from '@/src/interfaces'

export type RunMetadata = {
  runId: string
  mode: 'baseline' | 'mcp' | 'skills' | string
  models: string[]
  evalKeys: string[]
  suiteHash: string
  harnessCommit?: string
  skillsCommit?: string
  mcpServerUrl?: string
  createdAt?: string
}

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
  if (!colNames.has('evaluation_path')) {
    db.run('ALTER TABLE results ADD COLUMN evaluation_path TEXT')
  }
  if (!colNames.has('eval_key')) {
    db.run('ALTER TABLE results ADD COLUMN eval_key TEXT')
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS runs (
      run_id TEXT PRIMARY KEY,
      mode TEXT NOT NULL,
      models_json TEXT NOT NULL,
      eval_keys_json TEXT NOT NULL,
      suite_hash TEXT NOT NULL,
      harness_commit TEXT,
      skills_commit TEXT,
      mcp_server_url TEXT,
      created_at TEXT NOT NULL
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

  // Migrations: add trial and failure_type columns to errors
  const errorCols = db.query('PRAGMA table_info(errors)').all() as { name: string }[]
  const errorColNames = new Set(errorCols.map((c) => c.name))
  if (!errorColNames.has('trial')) {
    db.run('ALTER TABLE errors ADD COLUMN trial INTEGER')
    db.run("ALTER TABLE errors ADD COLUMN failure_type TEXT DEFAULT 'model'")
  }
}

export function saveRun(metadata: RunMetadata) {
  const query = db.query(`
    INSERT OR REPLACE INTO runs (
      run_id,
      mode,
      models_json,
      eval_keys_json,
      suite_hash,
      harness_commit,
      skills_commit,
      mcp_server_url,
      created_at
    )
    VALUES (
      $run_id,
      $mode,
      $models_json,
      $eval_keys_json,
      $suite_hash,
      $harness_commit,
      $skills_commit,
      $mcp_server_url,
      $created_at
    )
  `)

  query.run({
    $run_id: metadata.runId,
    $mode: metadata.mode,
    $models_json: JSON.stringify(metadata.models),
    $eval_keys_json: JSON.stringify(metadata.evalKeys),
    $suite_hash: metadata.suiteHash,
    $harness_commit: metadata.harnessCommit ?? null,
    $skills_commit: metadata.skillsCommit ?? null,
    $mcp_server_url: metadata.mcpServerUrl ?? null,
    $created_at: metadata.createdAt ?? new Date().toISOString(),
  })
}

export function saveResult(runId: string, score: Score, evaluationPath?: string, evalKey?: string) {
  const query = db.query(`
    INSERT INTO results (run_id, model, label, framework, category, value, timestamp, tokens_in, tokens_out, cost_usd, duration_ms, evaluation_path, eval_key)
    VALUES ($run_id, $model, $label, $framework, $category, $value, $timestamp, $tokens_in, $tokens_out, $cost_usd, $duration_ms, $evaluation_path, $eval_key)
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
    $evaluation_path: evaluationPath ?? null,
    $eval_key: evalKey ?? score.evalKey ?? null,
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
    trial?: number
    failureType?: string
  },
) {
  const query = db.query(`
    INSERT INTO errors (run_id, model, label, framework, category, evaluation_path, error_message, stack_trace, timestamp, trial, failure_type)
    VALUES ($run_id, $model, $label, $framework, $category, $evaluation_path, $error_message, $stack_trace, $timestamp, $trial, $failure_type)
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
    $trial: details.trial ?? null,
    $failure_type: details.failureType ?? 'model',
  })
}

export type DBScore = Score & { evaluationPath?: string; runId?: string }

export function getResults(runId?: string): DBScore[] {
  let queryStr =
    'SELECT run_id, model, label, framework, category, value, timestamp as updatedAt, tokens_in, tokens_out, cost_usd, duration_ms as durationMs, evaluation_path, eval_key FROM results'
  if (runId) {
    queryStr += ' WHERE run_id = $run_id'
  }
  queryStr += ' ORDER BY timestamp DESC'

  const query = db.query(queryStr)
  const results = runId ? query.all({ $run_id: runId }) : query.all()

  return mapRows(results as Array<Record<string, unknown>>)
}

/**
 * Get all results with timestamps >= since, grouped by run_id prefix (mode).
 * Used by report-braintrust.ts to consolidate batch results.
 */
export function getResultsSince(since: string): DBScore[] {
  const query = db.query(
    'SELECT model, label, framework, category, value, timestamp as updatedAt, tokens_in, tokens_out, cost_usd, duration_ms as durationMs, evaluation_path, eval_key, run_id FROM results WHERE timestamp >= $since ORDER BY timestamp DESC',
  )
  return mapRows(query.all({ $since: since }) as Array<Record<string, unknown>>)
}

/**
 * Get all distinct run_ids since a given timestamp, useful for batch grouping.
 */
export function getRunIdsSince(since: string): string[] {
  const query = db.query(
    'SELECT DISTINCT run_id FROM results WHERE timestamp >= $since ORDER BY run_id',
  )
  return (query.all({ $since: since }) as Array<{ run_id: string }>).map((r) => r.run_id)
}

function mapRows(results: Array<Record<string, unknown>>): DBScore[] {
  return results.map((r) => ({
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
    ...(r.evaluation_path != null && { evaluationPath: r.evaluation_path as string }),
    ...(r.eval_key != null && { evalKey: r.eval_key as string }),
    ...(r.run_id != null && { runId: r.run_id as string }),
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
