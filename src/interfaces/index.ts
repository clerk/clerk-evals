import type { Provider } from '@/src/providers'
import type { Result } from '@/src/utils/result'

// Re-export agent types
export type {
  AgentExecResult,
  AgentInfo,
  AgentMCPConfig,
  AgentRunnerArgs,
  AgentSkillsConfig,
  AgentType,
} from './agent'
export { AGENTS, getAgentInfo, getAllAgentTypes } from './agent'

/**
 * Skill metadata extracted from SKILL.md frontmatter.
 */
export type SkillMetadata = {
  name: string
  description: string
  /** Absolute path to skill directory */
  path: string
}

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
  finishReason?: string
}

export type TokenUsage = {
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

/**
 * Every Runner function must return a RunnerResult
 * and should never throw under normal circumstances.
 */
export type RunnerResult = Result<{
  score: number
  debug?: RunnerDebugPayload
  tokens?: TokenUsage
  durationMs?: number
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
 * Extended runner args for skills evaluations (supports optional MCP)
 */
export type SkillsRunnerArgs = RunnerArgs & {
  skillsPath: string
  mcpServerUrl?: string
  maxToolRounds?: number
}

/**
 * Consolidated runner args — mode inferred from optional fields.
 * Superset of RunnerArgs, MCPRunnerArgs, and SkillsRunnerArgs.
 */
export type ExecArgs = RunnerArgs & {
  mcpServerUrl?: string
  skillsPath?: string
  maxToolRounds?: number
}

/**
 * Supported frameworks
 */
export type Framework = 'Next.js' | 'React' | 'iOS' | 'Android'

/**
 * Categories aligned with Clerk product verticals
 */
export type Category =
  | 'Quickstarts'
  | 'Auth'
  | 'User Management'
  | 'UI Components'
  | 'Organizations'
  | 'Webhooks'
  | 'Billing'
  | 'Upgrades'
  | 'Add Auth'

/**
 * Behavioral capability tags for slicing evals by what model behavior they test,
 * independent of Clerk product vertical.
 *
 * Each eval has exactly one `primaryCapability` (what it primarily tests)
 * and optional secondary `capabilities` for filtering.
 */
export type Capability =
  | 'api_knowledge'
  | 'framework_detection'
  | 'migration_reasoning'
  | 'negative_constraint'
  | 'tool_composition'
  | 'ui_composition'
  | 'webhook_integration'

/**
 * Origin of an eval — why it was created.
 */
export type EvalSource = 'dogfooding' | 'regression' | 'coverage' | 'manual'

export type Evaluation = {
  framework: Framework
  category: Category
  /** e.g. "evals/basic-nextjs" */
  path: string
  /** Variant subdirectory for fixture-based evals (e.g., 'nextjs', 'android') */
  variant?: string
  /** What behavior this eval measures */
  description: string
  /** The single capability this eval primarily tests — used for leaderboard slicing */
  primaryCapability: Capability
  /** Additional capability tags for filtering (optional) */
  capabilities?: Capability[]
  /** Why this eval was created */
  source?: EvalSource
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
  tokens?: TokenUsage
  costUsd?: number
  durationMs?: number
}
