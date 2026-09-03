import { describe, expect, test } from 'bun:test'
import { defineGraders } from '@/src/graders'
import { parseContractFixture } from './fixtures'

const graders = defineGraders({
  first: async () => true,
  second: async () => false,
})

describe('grader contract fixtures', () => {
  test('expects every grader to pass for an accepted fixture', () => {
    const fixture = parseContractFixture('response', 'accepted/reference.md', graders, true)
    expect(fixture.expected).toEqual({ first: true, second: true })
  })

  test('expands a rejected fail list into complete expectations', () => {
    const fixture = parseContractFixture(
      '---\nfail:\n  - second\n---\nresponse',
      'rejected/missing-second.md',
      graders,
      false,
    )
    expect(fixture.expected).toEqual({ first: true, second: false })
  })

  test('rejects unknown grader names', () => {
    expect(() =>
      parseContractFixture(
        '---\nfail:\n  - unknown\n---\nresponse',
        'rejected/unknown.md',
        graders,
        false,
      ),
    ).toThrow('unknown graders: unknown')
  })
})
