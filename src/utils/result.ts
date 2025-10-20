/**
 * Railway programming error handling types and utilities.
 *
 * Provides a Result<T, E> type that represents either a success (ok: true, value: T)
 * or an error (ok: false, error: E), along with helper functions to create
 * success and error results.
 */
export type Result<T, E = unknown> =
  | { ok: true; value: T; error?: never }
  | { ok: false; value?: never; error: E }

/**
 * Creates a successful Result containing the given value.
 */
export function OK<V>(value: V): Result<V, never> {
  return { ok: true, value }
}

/**
 * Creates an error Result containing the given error.
 */
export function ERR<E>(error: E): Result<never, E> {
  return { ok: false, error }
}
