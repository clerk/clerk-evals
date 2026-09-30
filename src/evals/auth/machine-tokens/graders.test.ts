import path from 'node:path'
import { describe, expect, test } from 'bun:test'
import { runGraderContract } from '@/src/grader-contract'

describe('machine token graders', () => {
  test('satisfy the accepted and rejected response contract', async () => {
    const report = await runGraderContract({ evalPath: path.dirname(import.meta.path) })
    const failures = report.cases.flatMap((testCase) =>
      testCase.observations
        .filter((observation) => observation.status !== 'passed')
        .map(
          (observation) =>
            `${testCase.name}: ${observation.grader} expected=${observation.expected} actual=${observation.actual}`,
        ),
    )

    expect(failures).toEqual([])
    expect(report.passed).toBe(true)
  })
})
