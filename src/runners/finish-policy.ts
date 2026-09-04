export type FinishPolicy = {
  grade: true
  truncated: boolean
}

/**
 * A response that reaches the model output limit is model behavior, not an
 * infrastructure failure. Grade the available output so the cell counts as
 * a result and the score reflects the incomplete answer.
 */
export function getFinishPolicy(finishReason: string): FinishPolicy {
  return { grade: true, truncated: finishReason === 'length' }
}
