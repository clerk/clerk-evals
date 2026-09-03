export const DEFAULT_EVAL_TASK_TIMEOUT_MS = 300_000

export function getEvalTaskTimeoutMs(value?: string | number): number {
  if (value === undefined) return DEFAULT_EVAL_TASK_TIMEOUT_MS

  const timeoutMs = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error(`Eval task timeout must be a positive number, received: ${value}`)
  }

  return timeoutMs
}
