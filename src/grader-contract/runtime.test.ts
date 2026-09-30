import { describe, expect, test } from 'bun:test'
import { defineGraders, type Graders } from '@/src/graders'
import { makeScorer } from '@/src/scorers/llm'
import { evaluateGraderContract, GraderContractError } from './runtime'

const localGraders = defineGraders({
  has_route: async (actual) => actual.includes('/api/example'),
  has_auth: async (actual) => actual.includes('auth()'),
})

describe('grader contract execution', () => {
  test('reports expected and actual values for every grader', async () => {
    const results = await evaluateGraderContract(localGraders, [
      {
        name: 'missing-auth',
        input: 'GET /api/example',
        expected: { has_route: true, has_auth: false },
      },
    ])

    expect(results[0]?.passed).toBe(true)
    expect(results[0]?.observations).toEqual([
      {
        grader: 'has_route',
        expected: true,
        actual: true,
        executed: true,
        status: 'passed',
      },
      {
        grader: 'has_auth',
        expected: false,
        actual: false,
        executed: true,
        status: 'passed',
      },
    ])
  })

  test('rejects unknown and missing grader expectations', async () => {
    expect(
      evaluateGraderContract(localGraders, [
        {
          name: 'invalid',
          input: 'GET /api/example',
          expected: { has_route: true, unknown: false },
        },
      ]),
    ).rejects.toBeInstanceOf(GraderContractError)
  })

  test('does not treat grader errors as expected failures', async () => {
    const graders: Graders = {
      throws: async () => {
        throw new Error('broken grader')
      },
    }
    const results = await evaluateGraderContract(graders, [
      { name: 'negative', input: 'bad response', expected: { throws: false } },
    ])

    expect(results[0]?.passed).toBe(false)
    expect(results[0]?.observations[0]).toMatchObject({
      actual: null,
      executed: true,
      status: 'error',
      error: 'broken grader',
    })
  })

  test('rejects API-backed graders before execution', async () => {
    const graders = { judge: makeScorer('Always pass') }
    expect(
      evaluateGraderContract(graders, [
        { name: 'api-backed', input: 'response', expected: { judge: true } },
      ]),
    ).rejects.toThrow('Grader contracts cannot run API-backed graders: judge')
  })
})
