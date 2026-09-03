import type { GraderContractReport } from './types'

export function formatGraderContractReport(report: GraderContractReport): string {
  const lines = [`${report.passed ? 'PASS' : 'FAIL'} ${report.evalPath}`]

  for (const testCase of report.cases) {
    lines.push(`  ${testCase.passed ? 'PASS' : 'FAIL'} ${testCase.name}`)
    for (const observation of testCase.observations) {
      const actual = observation.actual === null ? 'error' : String(observation.actual)
      const detail = observation.error ? ` error=${observation.error}` : ''
      lines.push(
        `    ${observation.status.toUpperCase()} ${observation.grader} expected=${observation.expected} actual=${actual}${detail}`,
      )
    }
  }

  return lines.join('\n')
}
