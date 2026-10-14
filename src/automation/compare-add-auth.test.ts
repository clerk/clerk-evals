import { describe, expect, test } from 'bun:test'
import type { Score } from '@/src/interfaces'
import { compareAddAuth } from './compare-add-auth'

const scores = (values: number[]): Score[] =>
  values.map((value, index) => ({
    model: 'claude-code:test',
    label: 'test',
    framework: 'Next.js',
    category: 'Add Auth',
    value,
    evalKey: `evals/add-auth::${['nextjs', 'react', 'android', 'ios'][index]}`,
  }))

describe('add-auth automation outcome', () => {
  test('classifies a completed lower Skills score as regression, not infrastructure failure', () => {
    expect(compareAddAuth(scores([1, 1, 1, 1]), scores([1, 1, 1, 0])).status).toBe('regression')
  })
  test('does not allow a missing column to look like a regression', () => {
    expect(() => compareAddAuth(scores([1, 1, 1, 1]), scores([1, 1]))).toThrow('Automation failure')
  })
})
