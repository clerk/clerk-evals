import type { Graders } from '@/src/graders'
import { isApiBackedGrader } from '@/src/scorers/llm'
import type {
  GraderContractCase,
  GraderContractCaseResult,
  GraderContractObservation,
} from './types'

export class GraderContractError extends Error {}

function validateCases(graders: Graders, cases: readonly GraderContractCase[]): void {
  const graderNames = Object.keys(graders)
  const knownGraders = new Set(graderNames)
  const caseNames = new Set<string>()

  if (cases.length === 0) {
    throw new GraderContractError('The grader contract has no cases')
  }

  for (const testCase of cases) {
    if (caseNames.has(testCase.name)) {
      throw new GraderContractError(`Duplicate grader contract case: ${testCase.name}`)
    }
    caseNames.add(testCase.name)

    const expectedNames = Object.keys(testCase.expected)
    const unknownNames = expectedNames.filter((name) => !knownGraders.has(name))
    const missingNames = graderNames.filter((name) => !(name in testCase.expected))

    if (unknownNames.length > 0) {
      throw new GraderContractError(
        `${testCase.name} refers to unknown graders: ${unknownNames.join(', ')}`,
      )
    }
    if (missingNames.length > 0) {
      throw new GraderContractError(
        `${testCase.name} has no expectation for graders: ${missingNames.join(', ')}`,
      )
    }
  }
}

function rejectApiBackedGraders(graders: Graders): void {
  const names = Object.entries(graders)
    .filter(([, grader]) => isApiBackedGrader(grader))
    .map(([name]) => name)

  if (names.length > 0) {
    throw new GraderContractError(
      `Grader contracts cannot run API-backed graders: ${names.join(', ')}`,
    )
  }
}

export async function evaluateGraderContract(
  graders: Graders,
  cases: readonly GraderContractCase[],
): Promise<GraderContractCaseResult[]> {
  rejectApiBackedGraders(graders)
  validateCases(graders, cases)

  const results: GraderContractCaseResult[] = []
  for (const testCase of cases) {
    const observations: GraderContractObservation[] = []

    for (const [name, grader] of Object.entries(graders)) {
      const expected = testCase.expected[name] as boolean
      try {
        const actual = await grader(testCase.input)
        observations.push({
          grader: name,
          expected,
          actual,
          executed: true,
          status: actual === expected ? 'passed' : 'failed',
        })
      } catch (error) {
        observations.push({
          grader: name,
          expected,
          actual: null,
          executed: true,
          status: 'error',
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    results.push({
      name: testCase.name,
      passed: observations.every((observation) => observation.status === 'passed'),
      observations,
    })
  }

  return results
}
