import type { GraderContractReport } from './types'
import { loadGraders } from '@/src/runners/shared'
import { loadGraderContractCases } from './fixtures'
import { evaluateGraderContract } from './runtime'

export type { GraderContractReport } from './types'

export async function runGraderContract(args: { evalPath: string }): Promise<GraderContractReport> {
  const graders = await loadGraders(args.evalPath)
  const cases = await loadGraderContractCases(args.evalPath, graders)
  const results = await evaluateGraderContract(graders, cases)

  return {
    evalPath: args.evalPath,
    passed: results.every((result) => result.passed),
    cases: results,
  }
}
