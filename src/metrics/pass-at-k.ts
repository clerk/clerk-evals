/**
 * pass@k and pass^k metrics for multi-trial agent evaluations.
 *
 * - pass@k: Probability that at least 1 of k attempts succeeds (capability metric)
 * - pass^k: Probability that ALL k attempts succeed (reliability metric)
 *
 * References:
 * - Anthropic "Demystifying Evals": https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents
 * - Chen et al. "Evaluating Large Language Models Trained on Code" (Codex paper)
 */

/**
 * Unbiased estimator for pass@k.
 * Given n total samples with c correct, estimates probability of
 * at least 1 success in k samples.
 *
 * Formula: 1 - C(n-c, k) / C(n, k)
 * Where C(a, b) is the binomial coefficient.
 */
export function passAtK(results: boolean[], k?: number): number {
  const n = results.length
  if (n === 0) return 0

  const effectiveK = k ?? n
  const c = results.filter(Boolean).length

  if (c === 0) return 0
  if (effectiveK >= n) return c > 0 ? 1 : 0

  // Use log space to avoid overflow with large binomial coefficients
  // pass@k = 1 - C(n-c, k) / C(n, k)
  let logNumerator = 0
  let logDenominator = 0
  for (let i = 0; i < effectiveK; i++) {
    logNumerator += Math.log(n - c - i)
    logDenominator += Math.log(n - i)
  }

  // If n-c < k, then C(n-c, k) = 0, so pass@k = 1
  if (n - c < effectiveK) return 1

  return 1 - Math.exp(logNumerator - logDenominator)
}

/**
 * pass^k: Probability that ALL k attempts succeed.
 * Stricter metric - measures reliability, not just capability.
 *
 * Simple estimator: (c/n)^k
 */
export function passToTheK(results: boolean[], k?: number): number {
  const n = results.length
  if (n === 0) return 0

  const effectiveK = k ?? n
  const c = results.filter(Boolean).length
  const passRate = c / n

  return passRate ** effectiveK
}

/**
 * Summary statistics for a set of trial results.
 */
export type TrialSummary = {
  totalTrials: number
  passed: number
  failed: number
  passRate: number
  meanScore: number
  meanDurationMs: number
  passAt1: number
  passAtK: number
  passToTheK: number
}

export type TrialResult = {
  trial: number
  score: number
  durationMs: number
  success: boolean
}

/**
 * Compute summary statistics from trial results.
 */
export function summarizeTrials(trials: TrialResult[]): TrialSummary {
  if (trials.length === 0) {
    return {
      totalTrials: 0,
      passed: 0,
      failed: 0,
      passRate: 0,
      meanScore: 0,
      meanDurationMs: 0,
      passAt1: 0,
      passAtK: 0,
      passToTheK: 0,
    }
  }

  const successes = trials.map((t) => t.success)
  const passed = successes.filter(Boolean).length
  const k = trials.length

  return {
    totalTrials: k,
    passed,
    failed: k - passed,
    passRate: passed / k,
    meanScore: trials.reduce((sum, t) => sum + t.score, 0) / k,
    meanDurationMs: trials.reduce((sum, t) => sum + t.durationMs, 0) / k,
    passAt1: passAtK(successes, 1),
    passAtK: passAtK(successes),
    passToTheK: passToTheK(successes),
  }
}
