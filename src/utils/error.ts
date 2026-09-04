export function formatError(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error

  try {
    return JSON.stringify(error) ?? 'Unknown error'
  } catch {
    return 'Unknown error'
  }
}

const DIAGNOSTIC_ERROR_KEYS = [
  'type',
  'statusCode',
  'isRetryable',
  'generationId',
  'reason',
  'response',
  'validationError',
  'cause',
  'lastError',
  'errors',
] as const
const MAX_DIAGNOSTIC_DEPTH = 5
const MAX_DIAGNOSTIC_STRING_LENGTH = 4_000
const SENSITIVE_KEY = /authorization|api[-_]?key|cookie|secret|token/i

function toDiagnosticValue(value: unknown, depth: number, seen: WeakSet<object>): unknown {
  if (typeof value === 'string') {
    return value.length > MAX_DIAGNOSTIC_STRING_LENGTH
      ? `${value.slice(0, MAX_DIAGNOSTIC_STRING_LENGTH)}...[truncated]`
      : value
  }
  if (value === null || typeof value !== 'object') return value
  if (depth >= MAX_DIAGNOSTIC_DEPTH) return '[max depth]'
  if (seen.has(value)) return '[circular]'
  seen.add(value)

  if (Array.isArray(value)) {
    return value.map((item) => toDiagnosticValue(item, depth + 1, seen))
  }

  const source = value as Record<string, unknown>
  const result: Record<string, unknown> = {}
  if (value instanceof Error) {
    result.name = value.name
    result.message = value.message
    result.stack = value.stack
    for (const key of DIAGNOSTIC_ERROR_KEYS) {
      if (key in source) result[key] = toDiagnosticValue(source[key], depth + 1, seen)
    }
    return result
  }

  for (const [key, entry] of Object.entries(source)) {
    result[key] = SENSITIVE_KEY.test(key) ? '[redacted]' : toDiagnosticValue(entry, depth + 1, seen)
  }
  return result
}

export function formatErrorDetails(error: unknown): string {
  try {
    return JSON.stringify(toDiagnosticValue(error, 0, new WeakSet()), null, 2)
  } catch {
    return formatError(error)
  }
}
