/**
 * Agent-specific types for CLI-based evaluation runners.
 *
 * Unlike API-based runners that use AI SDK's generateText,
 * agent runners spawn CLI tools (Claude Code, Cursor, etc.)
 * and capture their stdout/stderr.
 */

/**
 * Supported agent types - extensible for future agents.
 */
export type AgentType = 'claude-code' | 'cursor'

/**
 * MCP configuration for agent runners.
 * When enabled, creates a temporary .mcp.json config file.
 */
export type AgentMCPConfig = {
  enabled: boolean
  serverUrl: string
}

/**
 * Skills configuration for agent runners.
 * When enabled, creates CLAUDE.md with relevant skill content for auto-discovery.
 */
export type AgentSkillsConfig = {
  enabled: boolean
  /** Path to the skills repo (e.g., /path/to/skills/skills) */
  sourcePath: string
  /** Eval path for skill mapping (e.g., 'evals/auth/protect') */
  evalPath: string
}

/**
 * Arguments passed to agent runners.
 */
export type AgentRunnerArgs = {
  /** The agent type to use */
  agent: AgentType
  /** Path to the evaluation directory */
  evalPath: string
  /** Enable debug output */
  debug?: boolean
  /** MCP configuration (optional) */
  mcpConfig?: AgentMCPConfig
  /** Skills configuration (optional) */
  skillsConfig?: AgentSkillsConfig
  /** Timeout in milliseconds (default: 600000 = 10 min) */
  timeout?: number
  /** Full path to the CLI executable (resolved in main process) */
  executablePath?: string
  /** PATH environment variable from main process */
  envPath?: string
}

/**
 * Raw result from agent execution (before grading).
 */
export type AgentExecResult = {
  /** Whether the CLI command succeeded */
  success: boolean
  /** Combined stdout/stderr output */
  output: string
  /** Execution duration in milliseconds */
  duration: number
  /** Error message if failed */
  error?: string
  /** Exit code from the CLI */
  exitCode?: number
}

/**
 * Information about an agent for display purposes.
 */
export type AgentInfo = {
  /** Agent type identifier */
  type: AgentType
  /** Human-readable label */
  label: string
  /** CLI command used */
  command: string
}

/**
 * Available agents configuration.
 */
export const AGENTS: Record<AgentType, AgentInfo> = {
  'claude-code': {
    type: 'claude-code',
    label: 'Claude Code',
    command: 'claude',
  },
  cursor: {
    type: 'cursor',
    label: 'Cursor',
    command: 'cursor', // Placeholder - adjust based on actual CLI
  },
}

/**
 * Get agent info by type.
 */
export function getAgentInfo(type: AgentType): AgentInfo {
  return AGENTS[type]
}

/**
 * Get all available agent types.
 */
export function getAllAgentTypes(): AgentType[] {
  return Object.keys(AGENTS) as AgentType[]
}
