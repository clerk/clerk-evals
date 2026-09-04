/**
 * Claude Code Agent Runner
 *
 * Spawns the Claude Code CLI to execute evaluations.
 * Supports MCP integration via temporary .mcp.json config.
 *
 * Uses --output-format stream-json to capture the final assistant message.
 * Graders also receive a snapshot of the final workspace.
 *
 * With MCP:
 *   Creates .mcp.json in working directory, then runs claude.
 */
import { spawn } from 'node:child_process'
import type { RunnerResult } from '@/src/interfaces'
import type { AgentExecResult, AgentRunnerArgs } from '@/src/interfaces/agent'
import { OK } from '@/src/utils/result'
import {
  AGENT_KILL_GRACE,
  buildAgentEnvironment,
  buildAgentPrompt,
  buildAgentTranscript,
  cleanupTempMCPConfig,
  cleanupTempWorkDir,
  copyWorkspace,
  createTempMCPConfig,
  createTempWorkDir,
  DEFAULT_AGENT_TIMEOUT,
  gradeAgentWorkspace,
  setupSkills,
} from './shared'

type StreamJsonMessage = {
  type: string
  message?: {
    role: string
    content: Array<{
      type: string
      text?: string
      name?: string
      input?: Record<string, unknown>
      content?: string
    }>
  }
}

/**
 * Parse stream-json NDJSON output and return the final assistant text block.
 */
export function parseStreamJson(raw: string): string {
  const assistantMessages: string[] = []

  for (const line of raw.split('\n')) {
    if (!line.trim()) continue
    let msg: StreamJsonMessage
    try {
      msg = JSON.parse(line)
    } catch {
      continue
    }

    if (msg.type === 'assistant' && msg.message?.content) {
      const text = msg.message.content
        .filter((block) => block.type === 'text' && block.text)
        .map((block) => block.text)
        .join('\n\n')
      if (text) assistantMessages.push(text)
    }
  }

  return assistantMessages.at(-1) ?? ''
}

/**
 * Execute Claude Code CLI and capture the full conversation via stream-json.
 */
async function execClaude(
  prompt: string,
  workDir: string,
  timeout: number,
  executablePath: string,
  envPath: string,
  model: string,
  mcpConfigPath?: string,
): Promise<AgentExecResult> {
  const startTime = Date.now()

  return new Promise((resolve) => {
    const args = [
      '--print',
      '--output-format',
      'stream-json',
      '--verbose',
      '--no-session-persistence',
      '--setting-sources',
      'project',
      '--strict-mcp-config',
      '--dangerously-skip-permissions',
      // Pin the agent model explicitly — the CLI flag wins over user settings
      // and session context, which otherwise select a model the eval API key
      // may not serve (instant 404, graded as a zero-score husk). Resolved in
      // the main process: Tinypool workers run with a trimmed environment.
      '--model',
      model,
      ...(mcpConfigPath ? ['--mcp-config', mcpConfigPath] : []),
      prompt,
    ]

    const proc = spawn(executablePath, args, {
      cwd: workDir,
      env: buildAgentEnvironment('claude-code', envPath),
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let stdout = ''
    let timedOut = false
    let forceKillId: ReturnType<typeof setTimeout> | undefined

    proc.stdout.on('data', (data: Buffer) => {
      stdout += data.toString()
    })

    // stderr is ignored for grading — only used for CLI diagnostics
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
      const fullOutput = parseStreamJson(stdout)

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
      const fullOutput = parseStreamJson(stdout)
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
 * Claude Code agent runner.
 *
 * 1. Load prompt from PROMPT.md
 * 2. Create .mcp.json if MCP enabled
 * 3. Spawn claude CLI with --print --dangerously-skip-permissions
 * 4. Wait for completion (with timeout)
 * 5. Load graders and run against output
 * 6. Return { score, debug? }
 */
export default async function exec({
  evalPath,
  debug = false,
  mcpConfig,
  skillsConfig,
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
  let mcpConfigPath: string | undefined

  try {
    // 1. Build prompt
    const prompt = await buildAgentPrompt(evalPath)

    // 2. Create temp work directory
    const evalName = evalPath.split('/').slice(-2).join('-')
    workDir = await createTempWorkDir(evalName)

    // 2b. Copy fixtures into work dir (before MCP/skills setup)
    if (workspacePath) {
      await copyWorkspace(workDir, workspacePath)
    }

    // 3. Create MCP config if enabled
    if (mcpConfig?.enabled) {
      mcpConfigPath = await createTempMCPConfig(workDir, mcpConfig)
    }

    // 3b. Setup skills if enabled
    if (skillsConfig?.enabled) {
      const linkedSkills = await setupSkills(
        workDir,
        skillsConfig.sourcePath,
        skillsConfig.evalPath,
      )
      if (debug && linkedSkills.length > 0) {
        console.log(
          `[skills] Loaded skills for ${skillsConfig.evalPath}: ${linkedSkills.join(', ')}`,
        )
        // Debug: verify CLAUDE.md was created
        const fs = await import('node:fs/promises')
        const claudeMdPath = `${workDir}/CLAUDE.md`
        try {
          const content = await fs.readFile(claudeMdPath, 'utf8')
          console.log(`[skills] CLAUDE.md created at: ${claudeMdPath}`)
          console.log(`[skills] CLAUDE.md size: ${content.length} chars`)
          console.log(`[skills] CLAUDE.md preview: ${content.slice(0, 200)}...`)
        } catch {
          console.log(`[skills] ERROR: CLAUDE.md not found at ${claudeMdPath}`)
        }
      }
    }

    // 4. Execute Claude Code CLI
    if (debug) {
      console.log(`[debug] Executing Claude Code in workDir: ${workDir}`)
    }
    const result = await execClaude(
      prompt,
      workDir,
      timeout,
      executablePath,
      envPath,
      model,
      mcpConfigPath,
    )

    if (!result.success) {
      return { ok: false as const, error: result.error || 'Claude Code execution failed' }
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
              agentLabel: 'Claude Code',
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
    // Return error as string for cross-process serialization
    const errorMessage = error instanceof Error ? error.message : String(error)
    return { ok: false as const, error: errorMessage }
  } finally {
    // Cleanup — skip work dir cleanup in debug mode so it can be inspected
    if (mcpConfigPath) {
      await cleanupTempMCPConfig(mcpConfigPath)
    }
    if (workDir && !debug) {
      await cleanupTempWorkDir(workDir)
    }
    if (workDir && debug) {
      console.log(`[debug] Work dir preserved: ${workDir}`)
    }
  }
}
