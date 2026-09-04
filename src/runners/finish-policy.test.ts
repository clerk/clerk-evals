import { describe, expect, test } from 'bun:test'

import { getFinishPolicy } from './finish-policy'

describe('model finish policy', () => {
  test('grades output that reaches the token limit', () => {
    expect(getFinishPolicy('length')).toEqual({ grade: true, truncated: true })
  })

  test('grades normally completed output', () => {
    expect(getFinishPolicy('stop')).toEqual({ grade: true, truncated: false })
  })
})
