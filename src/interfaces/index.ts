import type { Provider } from '@/src/providers'
import type { Result } from '@/src/utils/result'

export type ToolCallInfo = {
  toolName: string
  args: unknown
}

export type ToolResultInfo = {
  toolName: string
  result: unknown
}

export type RunnerDebugPayload = {
  prompt: string
  response: string
  graders: [string, boolean][]
  toolCalls?: ToolCallInfo[]
  toolResults?: ToolResultInfo[]
  transcript?: string
}

/**
 * Every Runner function must return a RunnerResult
 * and should never throw under normal circumstances.
 */
export type RunnerResult = Result<{
  score: number
  debug?: RunnerDebugPayload
}>

/**
 * Arguments to be passed to the runner
 */
export type RunnerArgs = {
  provider: Provider
  model: string
  evalPath: string
  debug?: boolean
}

/**
 * Extended runner args for MCP evaluations
 */
export type MCPRunnerArgs = RunnerArgs & {
  mcpServerUrl: string
  maxToolRounds?: number
}

/**
 * Supported frameworks
 */
export type Framework = 'Next.js' // TODO(voz): Add more frameworks in the future

/**
 * Categories aligned with Clerk product verticals
 */
export type Category = 'Auth' | 'Billing' | 'Organizations' | 'Webhooks'
export type Evaluation = {
  framework: Framework
  category: Category
  /** e.g. "evals/basic-nextjs" */
  path: string
}

/**
 * A single score object for a model and category
 */
export type Score = {
  model: string
  label: string
  framework: Framework
  category: Category
  value: number
  updatedAt?: string
}
