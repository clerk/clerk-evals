/**
 * Shared utilities for agent-based evaluation runners.
 */
import * as fs from 'node:fs/promises'
import { tmpdir } from 'node:os'
import * as path from 'node:path'
import { spawn } from 'node:child_process'
import { createSkillsClaudeMd } from '@/src/config/skills'
import type {
  AgentExecResult,
  AgentMCPConfig,
  AgentType,
  ResolvedAgentVerificationConfig,
} from '@/src/interfaces/agent'
import type { Graders } from '@/src/graders'
import { computeScore, runGraders } from '@/src/runners/shared'

/**
 * Default timeout for agent execution (10 minutes).
 */
export const DEFAULT_AGENT_TIMEOUT = 600_000
export const AGENT_KILL_GRACE = 5_000
const DEFAULT_HIDDEN_VERIFICATION_TIMEOUT = 120_000
const MAX_HIDDEN_VERIFICATION_OUTPUT = 100_000

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
  const prefix = suffix ? `clerk-evals-${suffix}-` : 'clerk-evals-'
  return fs.mkdtemp(path.join(tmpdir(), prefix))
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

/** Copy the workspace before MCP and skill setup so their files stay as overlays. */
export async function copyWorkspace(workDir: string, workspacePath: string): Promise<void> {
  await fs.cp(workspacePath, workDir, { recursive: true, force: true })
}

const SNAPSHOT_EXCLUSIONS = new Set([
  '.git',
  '.mcp.json',
  '.skills',
  'AGENTS.md',
  'bun.lock',
  'bun.lockb',
  'CLAUDE.md',
  'node_modules',
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
])
const MAX_SNAPSHOT_FILES = 200
const MAX_SNAPSHOT_BYTES = 1_000_000

export async function snapshotWorkDir(workDir: string): Promise<string> {
  const files: Array<{ path: string; content: string }> = []
  let totalBytes = 0

  async function walk(directory: string, relativeDir = ''): Promise<void> {
    if (files.length >= MAX_SNAPSHOT_FILES || totalBytes >= MAX_SNAPSHOT_BYTES) return
    const entries = await fs.readdir(directory, { withFileTypes: true })
    entries.sort((a, b) => a.name.localeCompare(b.name))

    for (const entry of entries) {
      if (files.length >= MAX_SNAPSHOT_FILES || totalBytes >= MAX_SNAPSHOT_BYTES) return
      if (SNAPSHOT_EXCLUSIONS.has(entry.name) || entry.name.startsWith('.env')) continue

      const absolutePath = path.join(directory, entry.name)
      const relativePath = path.join(relativeDir, entry.name)
      if (entry.isDirectory()) {
        await walk(absolutePath, relativePath)
        continue
      }
      if (!entry.isFile()) continue

      const buffer = await fs.readFile(absolutePath)
      if (
        buffer.length > 256_000 ||
        totalBytes + buffer.length > MAX_SNAPSHOT_BYTES ||
        buffer.includes(0)
      ) {
        continue
      }
      files.push({ path: relativePath, content: buffer.toString('utf8') })
      totalBytes += buffer.length
    }
  }

  await walk(workDir)
  return files.map((file) => `### ${file.path}\n\n${file.content}`).join('\n\n')
}

export async function buildAgentGradingArtifact(
  workDir: string,
  finalResponse: string,
): Promise<string> {
  const workspace = await snapshotWorkDir(workDir)
  return [`## Final response\n\n${finalResponse}`, `## Final workspace\n\n${workspace}`].join(
    '\n\n',
  )
}

export type HiddenVerificationResult = {
  passed: boolean
  output: string
  durationMs: number
  exitCode?: number
}

export type AgentWorkspaceGradingResult = {
  gradingArtifact: string
  graderResults: [string, boolean][]
  score: number
  hiddenVerification?: HiddenVerificationResult
}

function buildVerificationEnvironment(envPath: string, workDir: string): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    CLERK_EVAL_WORKSPACE: workDir,
    NODE_ENV: 'test',
    PATH: envPath,
  }
  for (const name of ['HOME', 'LANG', 'LC_ALL', 'NO_COLOR', 'SSL_CERT_FILE', 'TERM', 'TMPDIR']) {
    if (process.env[name]) env[name] = process.env[name]
  }
  return env
}

export async function runHiddenVerification(
  workDir: string,
  config: ResolvedAgentVerificationConfig,
  envPath: string,
): Promise<HiddenVerificationResult> {
  const startTime = Date.now()
  const testsDir = await createTempWorkDir('hidden-tests')

  try {
    await fs.cp(config.testsPath, testsDir, { recursive: true, force: true })

    return await new Promise((resolve, reject) => {
      const proc = spawn(process.execPath, ['test', testsDir], {
        cwd: testsDir,
        env: buildVerificationEnvironment(envPath, workDir),
        stdio: ['ignore', 'pipe', 'pipe'],
      })

      let output = ''
      let timedOut = false
      let forceKillId: ReturnType<typeof setTimeout> | undefined

      const appendOutput = (data: Buffer) => {
        if (output.length >= MAX_HIDDEN_VERIFICATION_OUTPUT) return
        output += data.toString().slice(0, MAX_HIDDEN_VERIFICATION_OUTPUT - output.length)
      }

      proc.stdout.on('data', appendOutput)
      proc.stderr.on('data', appendOutput)

      const timeoutId = setTimeout(() => {
        timedOut = true
        proc.kill('SIGTERM')
        forceKillId = setTimeout(() => proc.kill('SIGKILL'), AGENT_KILL_GRACE)
      }, DEFAULT_HIDDEN_VERIFICATION_TIMEOUT)

      proc.on('close', (code) => {
        clearTimeout(timeoutId)
        if (forceKillId) clearTimeout(forceKillId)
        const sanitizedOutput = output
          .replaceAll(testsDir, '<hidden-tests>')
          .replaceAll(workDir, '<workspace>')
        resolve({
          passed: !timedOut && code === 0,
          output: timedOut
            ? `${sanitizedOutput}\nTimed out after ${DEFAULT_HIDDEN_VERIFICATION_TIMEOUT}ms`
            : sanitizedOutput,
          durationMs: Date.now() - startTime,
          exitCode: code ?? -1,
        })
      })

      proc.on('error', (error) => {
        clearTimeout(timeoutId)
        if (forceKillId) clearTimeout(forceKillId)
        reject(error)
      })
    })
  } finally {
    await cleanupTempWorkDir(testsDir)
  }
}

export async function gradeAgentWorkspace(args: {
  workDir: string
  finalResponse: string
  evalPath: string
  gradersPath?: string
  verification?: ResolvedAgentVerificationConfig
  envPath: string
}): Promise<AgentWorkspaceGradingResult> {
  const gradingArtifact = await buildAgentGradingArtifact(args.workDir, args.finalResponse)
  const graderModule = args.gradersPath
    ? ((await import(args.gradersPath)) as { graders: Graders })
    : ((await import(path.join(args.evalPath, 'graders.ts'))) as { graders: Graders })

  const graderResults = await runGraders(graderModule.graders, gradingArtifact)
  const hiddenVerification = args.verification
    ? await runHiddenVerification(args.workDir, args.verification, args.envPath)
    : undefined

  const hiddenGraderResult: [string, boolean] | undefined = hiddenVerification
    ? ['hidden_functional_tests', hiddenVerification.passed]
    : undefined
  const resultsWithHidden = hiddenGraderResult
    ? [...graderResults, hiddenGraderResult]
    : graderResults
  const score = hiddenVerification?.passed === false ? 0 : computeScore(graderResults)

  return {
    gradingArtifact,
    graderResults: resultsWithHidden,
    score,
    hiddenVerification,
  }
}

export function buildAgentTranscript(args: {
  agentLabel: string
  prompt: string
  result: AgentExecResult
  graderResults: [string, boolean][]
  gradingArtifact: string
  hiddenVerification?: HiddenVerificationResult
  score: number
}): string {
  const scorePercent = (args.score * 100).toFixed(1)
  const hiddenSummary = args.hiddenVerification
    ? `\n\n## Hidden Verification\n**Passed**: ${args.hiddenVerification.passed}\n**Duration**: ${(args.hiddenVerification.durationMs / 1000).toFixed(2)}s\n**Exit Code**: ${args.hiddenVerification.exitCode ?? 'unknown'}`
    : ''

  return `# ${args.agentLabel} Agent Transcript

## Execution Info
- **Duration**: ${(args.result.duration / 1000).toFixed(2)}s
- **Exit Code**: ${args.result.exitCode}
- **Success**: ${args.result.success}

## Prompt
\`\`\`markdown
${args.prompt.trim()}
\`\`\`

## Output
\`\`\`
${args.gradingArtifact.slice(0, 10000)}${args.gradingArtifact.length > 10000 ? '\n... (truncated)' : ''}
\`\`\`
${hiddenSummary}

## Grader Results
**Score: ${scorePercent}%**

| Grader | Result |
|--------|--------|
${args.graderResults.map(([name, p]) => `| ${name} | ${p ? 'PASS' : 'FAIL'} |`).join('\n')}
`
}

export function buildAgentEnvironment(agentType: AgentType, envPath: string): NodeJS.ProcessEnv {
  const apiKeyName = agentType === 'claude-code' ? 'ANTHROPIC_API_KEY' : 'OPENAI_API_KEY'
  const allowedNames = [
    apiKeyName,
    'HOME',
    'LANG',
    'LC_ALL',
    'NO_COLOR',
    'SSL_CERT_FILE',
    'TERM',
    'TMPDIR',
  ]
  const env: NodeJS.ProcessEnv = { PATH: envPath }
  for (const name of allowedNames) {
    if (process.env[name]) env[name] = process.env[name]
  }
  return env
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
  return createSkillsClaudeMd(evalPath, skillsSourcePath, workDir)
}

/**
 * Agent-specific context file names.
 * Each agent loads its own context file at startup.
 */
export const AGENT_CONTEXT_FILES: Record<string, string> = {
  'claude-code': 'CLAUDE.md',
  codex: 'AGENTS.md',
  gemini: 'GEMINI.md',
  cursor: '.cursorrules',
}

/**
 * Write agent-specific context files into the work directory.
 * If skills were loaded into CLAUDE.md, also copies the content
 * to the appropriate context file for the target agent.
 */
export async function setupAgentContext(workDir: string, agentType: string): Promise<void> {
  const contextFile = AGENT_CONTEXT_FILES[agentType]
  if (!contextFile || contextFile === 'CLAUDE.md') return

  // If CLAUDE.md exists (from setupSkills), copy content to agent-specific file
  const claudeMdPath = path.join(workDir, 'CLAUDE.md')
  try {
    const content = await fs.readFile(claudeMdPath, 'utf8')
    await fs.writeFile(path.join(workDir, contextFile), content)
  } catch {
    // No CLAUDE.md exists, nothing to copy
  }
}
