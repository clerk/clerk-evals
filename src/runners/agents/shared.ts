/**
 * Shared utilities for agent-based evaluation runners.
 */
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { symlinkSkills } from '@/src/config/skills'
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
 * Loads the PROMPT.md from an evaluation directory.
 */
export async function loadPrompt(evalPath: string): Promise<string> {
  return fs.readFile(path.join(evalPath, 'PROMPT.md'), 'utf8')
}

/**
 * Builds the full prompt for an agent from the eval prompt.
 */
export async function buildAgentPrompt(evalPath: string): Promise<string> {
  const evalPrompt = await loadPrompt(evalPath)
  return `Do not ask clarifying questions. Complete the task with the information provided.\n\n---\n\n${evalPrompt}`
}

/**
 * Creates a temporary working directory for agent execution.
 */
export async function createTempWorkDir(suffix?: string): Promise<string> {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const name = suffix ? `run-${id}-${suffix}` : `run-${id}`
  const tempDir = path.join(process.cwd(), '.agent-temp', name)
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

/**
 * Copies fixture files into the agent's working directory.
 * Must be called before createTempMCPConfig/setupSkills so overlays work correctly.
 */
export async function copyFixtures(workDir: string, fixturesPath: string): Promise<void> {
  await fs.cp(fixturesPath, workDir, { recursive: true, force: true })
}

/**
 * Setup skills for Claude Code auto-discovery.
 * Creates CLAUDE.md with skill content in the working directory.
 * Claude Code automatically loads CLAUDE.md at startup.
 *
 * @param workDir - Temporary working directory for the eval
 * @param skillsSourcePath - Path to the skills repo
 * @param evalPath - Eval path for skill mapping (e.g., 'evals/auth/protect')
 * @returns Array of skill names that were successfully loaded
 */
export async function setupSkills(
  workDir: string,
  skillsSourcePath: string,
  evalPath: string,
): Promise<string[]> {
  return symlinkSkills(evalPath, skillsSourcePath, workDir)
}
