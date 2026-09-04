export type GraderContractCase = {
  name: string
  input: string
  expected: Readonly<Record<string, boolean>>
}

export type GraderContractObservation = {
  grader: string
  expected: boolean
  actual: boolean | null
  executed: boolean
  status: 'passed' | 'failed' | 'error'
  error?: string
}

export type GraderContractCaseResult = {
  name: string
  passed: boolean
  observations: GraderContractObservation[]
}

export type GraderContractReport = {
  evalPath: string
  passed: boolean
  cases: GraderContractCaseResult[]
}
