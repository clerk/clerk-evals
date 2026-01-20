/**
 * Shared utilities for agent-based evaluation runners.
 */
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import type { AgentMCPConfig } from '@/src/interfaces/agent'

/**
 * Default timeout for agent execution (10 minutes).
 */
export const DEFAULT_AGENT_TIMEOUT = 600_000

/**
 * MCP config template for Claude Code.
 * Uses Streamable HTTP transport to connect to Clerk MCP server.
 */
export function buildMCPConfig(serverUrl: string): object {
  return {
    mcpServers: {
      clerk: {
        type: 'url',
        url: serverUrl,
      },
    },
  }
}

/**
 * Creates a temporary .mcp.json file for Claude Code.
 * Returns the path to the created file.
 */
export async function createTempMCPConfig(
  workDir: string,
  mcpConfig: AgentMCPConfig,
): Promise<string> {
  const configPath = path.join(workDir, '.mcp.json')
  const config = buildMCPConfig(mcpConfig.serverUrl)
  await fs.writeFile(configPath, JSON.stringify(config, null, 2))
  return configPath
}

/**
 * Removes the temporary MCP config file.
 */
export async function cleanupTempMCPConfig(configPath: string): Promise<void> {
  try {
    await fs.unlink(configPath)
  } catch {
    // Ignore errors if file doesn't exist
  }
}

/**
 * System instruction for agent prompts.
 * Similar to the API runner but adapted for CLI output.
 */
export const AGENT_SYSTEM_INSTRUCTION = `
YOU MUST output all files as fenced code blocks, like so

\`\`\`lang file="path/to/file.ts"
// file content
\`\`\`

Do not ask clarifying questions. Complete the task with the information provided.
`

/**
 * Loads the PROMPT.md from an evaluation directory.
 */
export async function loadPrompt(evalPath: string): Promise<string> {
  return fs.readFile(path.join(evalPath, 'PROMPT.md'), 'utf8')
}

/**
 * Builds the full prompt for an agent, combining system instruction and eval prompt.
 */
export async function buildAgentPrompt(evalPath: string): Promise<string> {
  const evalPrompt = await loadPrompt(evalPath)
  return `${AGENT_SYSTEM_INSTRUCTION.trim()}\n\n---\n\n${evalPrompt}`
}

/**
 * Parses agent output to extract file blocks.
 * Useful for debugging and validation.
 */
export function extractFileBlocks(output: string): Map<string, string> {
  const files = new Map<string, string>()
  // Match code blocks with file="path" attribute
  const regex = /```[\w-]*\s+file="([^"]+)"\n([\s\S]*?)```/g
  let match: RegExpExecArray | null = regex.exec(output)

  while (match !== null) {
    const [, filePath, content] = match
    if (filePath && content) {
      files.set(filePath, content.trim())
    }
    match = regex.exec(output)
  }

  return files
}

/**
 * Creates a temporary working directory for agent execution.
 */
export async function createTempWorkDir(): Promise<string> {
  const tempDir = path.join(process.cwd(), '.agent-temp', `run-${Date.now()}`)
  await fs.mkdir(tempDir, { recursive: true })
  return tempDir
}

/**
 * Cleans up temporary working directory.
 */
export async function cleanupTempWorkDir(workDir: string): Promise<void> {
  try {
    await fs.rm(workDir, { recursive: true, force: true })
  } catch {
    // Ignore cleanup errors
  }
}
