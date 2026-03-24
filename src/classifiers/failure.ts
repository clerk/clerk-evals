/**
 * Failure classification for agent evaluation runs.
 *
 * Classifies failures into categories to filter noise from leaderboard:
 * - model: Agent couldn't solve the task (real failure, keep in leaderboard)
 * - infra: CLI crash, API key issue, network error (filter from leaderboard)
 * - timeout: Exceeded time limit (filter from leaderboard)
 *
 * Inspired by next-evals-oss classification.json pattern.
 */
import type { AgentExecResult } from '@/src/interfaces/agent'

export type FailureType = 'model' | 'infra' | 'timeout'

/**
 * Known infrastructure error patterns.
 */
const INFRA_PATTERNS = [
  'ECONNREFUSED',
  'ENOTFOUND',
  'ETIMEDOUT',
  'ECONNRESET',
  'API key',
  'api_key',
  'authentication',
  'rate limit',
  'rate_limit',
  '429',
  '503',
  '502',
  'spawn ENOENT',
  'command not found',
  'No such file or directory',
  'SIGKILL',
  'out of memory',
  'OOM',
]

/**
 * Classify a failed agent execution result.
 */
export function classifyFailure(result: AgentExecResult, timeoutMs: number): FailureType {
  // Timeout: duration is close to or exceeds the timeout
  if (result.duration >= timeoutMs * 0.95) {
    return 'timeout'
  }

  // Infra: exit code != 0 with no meaningful output
  if (result.exitCode !== 0 && !result.output?.trim()) {
    return 'infra'
  }

  // Infra: error message matches known infra patterns
  const errorText = `${result.error ?? ''} ${result.output ?? ''}`.toLowerCase()
  for (const pattern of INFRA_PATTERNS) {
    if (errorText.includes(pattern.toLowerCase())) {
      return 'infra'
    }
  }

  // Default: model failure (the agent tried but couldn't solve it)
  return 'model'
}

/**
 * Whether a failure type should be included in the leaderboard.
 * Only model failures count — infra/timeout are noise.
 */
export function isLeaderboardRelevant(failureType: FailureType): boolean {
  return failureType === 'model'
}
