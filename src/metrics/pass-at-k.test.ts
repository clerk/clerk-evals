import { describe, expect, test } from 'bun:test'
import { passAtK, passToTheK, summarizeTrials } from './pass-at-k'

describe('agent trial metrics', () => {
  test('separates capability from reliability', () => {
    const outcomes = [true, false, false]
    expect(passAtK(outcomes, 1)).toBeCloseTo(1 / 3)
    expect(passAtK(outcomes, 3)).toBe(1)
    expect(passToTheK(outcomes, 3)).toBeCloseTo(1 / 27)
  })

  test('summarizes strict task success', () => {
    const summary = summarizeTrials([
      { trial: 1, score: 1, durationMs: 100, success: true },
      { trial: 2, score: 0.8, durationMs: 200, success: false },
    ])
    expect(summary.passed).toBe(1)
    expect(summary.meanScore).toBe(0.9)
    expect(summary.meanDurationMs).toBe(150)
  })
})
