import { describe, expect, test } from 'bun:test'
import { DEFAULT_EVAL_TASK_TIMEOUT_MS, getEvalTaskTimeoutMs } from './timeout'

describe('eval task timeout', () => {
  test('uses a five minute default', () => {
    expect(getEvalTaskTimeoutMs()).toBe(DEFAULT_EVAL_TASK_TIMEOUT_MS)
    expect(DEFAULT_EVAL_TASK_TIMEOUT_MS).toBe(300_000)
  })

  test('accepts CLI and environment values', () => {
    expect(getEvalTaskTimeoutMs('120000')).toBe(120_000)
    expect(getEvalTaskTimeoutMs(60_000)).toBe(60_000)
  })

  test('rejects invalid values', () => {
    expect(() => getEvalTaskTimeoutMs('not-a-number')).toThrow('positive number')
    expect(() => getEvalTaskTimeoutMs(0)).toThrow('positive number')
  })
})
