/**
 * Codex Agent Runner
 *
 * Spawns the Codex CLI (codex exec) to execute evaluations.
 * Uses --json flag to capture JSONL events including tool calls and file writes.
 *
 * Key differences from Claude Code:
 * - Uses `codex exec` subcommand (non-interactive)
 * - Workspace-write sandbox permissions
 * - JSONL event stream via --json flag
 * - Context file: AGENTS.md (via setupAgentContext)
 */
import { execSync, spawn } from 'node:child_process'
import type { RunnerResult } from '@/src/interfaces'
import type { AgentExecResult, AgentRunnerArgs } from '@/src/interfaces/agent'
import { OK } from '@/src/utils/result'
import {
  AGENT_KILL_GRACE,
  buildAgentEnvironment,
  buildAgentPrompt,
  buildAgentTranscript,
  cleanupTempWorkDir,
  copyWorkspace,
  createTempWorkDir,
  DEFAULT_AGENT_TIMEOUT,
  gradeAgentWorkspace,
  getCodexGatewayArgs,
  setupAgentContext,
  setupSkills,
} from './shared'

/**
 * Codex JSONL event format (from `codex exec --json`).
 *
 * Real format observed:
 *   {"type":"item.completed","item":{"type":"agent_message","text":"..."}}
 *   {"type":"item.completed","item":{"type":"command_execution","command":"...","aggregated_output":"...","exit_code":0}}
 *   {"type":"item.completed","item":{"type":"file_edit","file_path":"...","content":"..."}}
 *   {"type":"turn.completed","usage":{"input_tokens":...,"output_tokens":...}}
 */
type CodexJsonEvent = {
  type: string
  item?: {
    type: string
    text?: string
    command?: string
    aggregated_output?: string
    exit_code?: number | null
    file_path?: string
    content?: string
    new_content?: string
  }
  usage?: {
    input_tokens: number
    output_tokens: number
  }
}

/**
 * Parse Codex JSONL output and return the final agent message.
 */
export function parseCodexJsonl(raw: string): string {
  const assistantMessages: string[] = []

  for (const line of raw.split('\n')) {
    if (!line.trim()) continue
    let event: CodexJsonEvent
    try {
      event = JSON.parse(line)
    } catch {
      continue
    }

    const item = event.item
    if (!item) continue

    // Agent text messages
    if (item.type === 'agent_message' && item.text) {
      assistantMessages.push(item.text)
    }
  }

  return assistantMessages.at(-1) ?? ''
}

/**
 * Execute Codex CLI and capture output via JSONL events.
 */
async function execCodex(
  prompt: string,
  workDir: string,
  timeout: number,
  executablePath: string,
  envPath: string,
  model: string,
  mcpServerUrl?: string,
): Promise<AgentExecResult> {
  const startTime = Date.now()

  return new Promise((resolve) => {
    const args = [
      'exec',
      '--json',
      '--ephemeral',
      '--sandbox',
      'workspace-write',
      '--ignore-user-config',
      '--ignore-rules',
      ...getCodexGatewayArgs(model),
      ...(mcpServerUrl
        ? ['--config', `mcp_servers.clerk.url=${JSON.stringify(mcpServerUrl)}`]
        : []),
      prompt,
    ]

    const proc = spawn(executablePath, args, {
      cwd: workDir,
      env: buildAgentEnvironment('codex', envPath),
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let stdout = ''
    let timedOut = false
    let forceKillId: ReturnType<typeof setTimeout> | undefined

    proc.stdout.on('data', (data: Buffer) => {
      stdout += data.toString()
    })

    // stderr is ignored for grading
    proc.stderr.on('data', () => {})

    const timeoutId = setTimeout(() => {
      timedOut = true
      proc.kill('SIGTERM')
      forceKillId = setTimeout(() => proc.kill('SIGKILL'), AGENT_KILL_GRACE)
    }, timeout)

    proc.on('close', (code) => {
      clearTimeout(timeoutId)
      if (forceKillId) clearTimeout(forceKillId)
      const duration = Date.now() - startTime
      const fullOutput = parseCodexJsonl(stdout)

      resolve({
        success: !timedOut && code === 0,
        output: fullOutput,
        duration,
        exitCode: timedOut ? -1 : (code ?? -1),
        error: timedOut
          ? `Timeout after ${timeout}ms`
          : code !== 0
            ? `Exit code: ${code}`
            : undefined,
      })
    })

    proc.on('error', (err) => {
      clearTimeout(timeoutId)
      if (forceKillId) clearTimeout(forceKillId)
      const fullOutput = parseCodexJsonl(stdout)
      resolve({
        success: false,
        output: fullOutput,
        duration: Date.now() - startTime,
        error: err.message,
        exitCode: -1,
      })
    })
  })
}

/**
 * Codex agent runner.
 *
 * 1. Load prompt from PROMPT.md
 * 2. Create temp work dir + copy fixtures
 * 3. Setup skills (AGENTS.md for Codex)
 * 4. Spawn codex exec with --json
 * 5. Wait for completion (with timeout)
 * 6. Run graders against output
 * 7. Return { score, debug? }
 */
export default async function exec({
  evalPath,
  debug = false,
  skillsConfig,
  mcpConfig,
  timeout = DEFAULT_AGENT_TIMEOUT,
  executablePath,
  envPath,
  model,
  workspacePath,
  gradersPath,
  verification,
}: AgentRunnerArgs): Promise<RunnerResult> {
  if (!executablePath) {
    return { ok: false as const, error: 'executablePath is required but was not provided' }
  }
  if (!envPath) {
    return { ok: false as const, error: 'envPath is required but was not provided' }
  }

  let workDir: string | undefined

  try {
    // 1. Build prompt
    const prompt = await buildAgentPrompt(evalPath)

    // 2. Create temp work directory
    const evalName = evalPath.split('/').slice(-2).join('-')
    workDir = await createTempWorkDir(evalName)

    // 2b. Copy fixtures into work dir
    if (workspacePath) {
      await copyWorkspace(workDir, workspacePath)
    }

    // 2c. Codex requires a git repo to run
    execSync('git init -q', { cwd: workDir, stdio: 'ignore' })

    // 3. Setup skills if enabled + agent-specific context file
    if (skillsConfig?.enabled) {
      const linkedSkills = await setupSkills(
        workDir,
        skillsConfig.sourcePath,
        skillsConfig.evalPath,
      )
      // Copy CLAUDE.md content to AGENTS.md for Codex
      await setupAgentContext(workDir, 'codex')

      if (debug && linkedSkills.length > 0) {
        console.log(
          `[skills] Loaded skills for ${skillsConfig.evalPath}: ${linkedSkills.join(', ')}`,
        )
      }
    }

    // 4. Execute Codex CLI
    if (debug) {
      console.log(`[debug] Executing Codex in workDir: ${workDir}`)
    }
    const result = await execCodex(
      prompt,
      workDir,
      timeout,
      executablePath,
      envPath,
      model,
      mcpConfig?.enabled ? mcpConfig.serverUrl : undefined,
    )

    if (!result.success) {
      return { ok: false as const, error: result.error || 'Codex execution failed' }
    }

    const grading = await gradeAgentWorkspace({
      workDir,
      finalResponse: result.output,
      evalPath,
      gradersPath,
      verification,
      envPath,
    })

    // 6. Return result
    return OK({
      score: grading.score,
      durationMs: result.duration + (grading.hiddenVerification?.durationMs ?? 0),
      debug: debug
        ? {
            prompt,
            response: grading.gradingArtifact,
            graders: grading.graderResults,
            transcript: buildAgentTranscript({
              agentLabel: 'Codex',
              prompt,
              result,
              graderResults: grading.graderResults,
              gradingArtifact: grading.gradingArtifact,
              hiddenVerification: grading.hiddenVerification,
              score: grading.score,
            }),
            hiddenVerification: grading.hiddenVerification
              ? {
                  passed: grading.hiddenVerification.passed,
                  durationMs: grading.hiddenVerification.durationMs,
                  exitCode: grading.hiddenVerification.exitCode,
                }
              : undefined,
          }
        : undefined,
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return { ok: false as const, error: errorMessage }
  } finally {
    // Cleanup — skip in debug mode for inspection
    if (workDir && !debug) {
      await cleanupTempWorkDir(workDir)
    }
    if (workDir && debug) {
      console.log(`[debug] Work dir preserved: ${workDir}`)
    }
  }
}
