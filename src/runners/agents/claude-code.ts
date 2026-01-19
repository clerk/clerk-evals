/**
 * Claude Code Agent Runner
 *
 * Spawns the Claude Code CLI to execute evaluations.
 * Supports MCP integration via temporary .mcp.json config.
 *
 * Usage:
 *   claude --print --dangerously-skip-permissions "prompt"
 *
 * With MCP:
 *   Creates .mcp.json in working directory, then runs claude.
 */
import { spawn } from 'node:child_process'
import type { RunnerResult } from '@/src/interfaces'
import type { AgentExecResult, AgentRunnerArgs } from '@/src/interfaces/agent'
import { computeScore, loadGraders, runGraders } from '@/src/runners/shared'
import { OK } from '@/src/utils/result'
import {
  buildAgentPrompt,
  cleanupTempMCPConfig,
  cleanupTempWorkDir,
  createTempMCPConfig,
  createTempWorkDir,
  DEFAULT_AGENT_TIMEOUT,
} from './shared'

/**
 * Execute Claude Code CLI and capture output.
 */
async function execClaude(
  prompt: string,
  workDir: string,
  timeout: number,
  executablePath: string,
  envPath: string,
): Promise<AgentExecResult> {
  const startTime = Date.now()

  return new Promise((resolve) => {
    const args = ['--print', '--dangerously-skip-permissions', prompt]

    const proc = spawn(executablePath, args, {
      cwd: workDir,
      env: {
        ...process.env,
        // Use PATH from main process to ensure node/bun are available
        PATH: envPath,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''

    proc.stdout.on('data', (data: Buffer) => {
      stdout += data.toString()
    })

    proc.stderr.on('data', (data: Buffer) => {
      stderr += data.toString()
    })

    const timeoutId = setTimeout(() => {
      proc.kill('SIGTERM')
      resolve({
        success: false,
        output: stdout + stderr,
        duration: Date.now() - startTime,
        error: `Timeout after ${timeout}ms`,
        exitCode: -1,
      })
    }, timeout)

    proc.on('close', (code) => {
      clearTimeout(timeoutId)
      const duration = Date.now() - startTime

      resolve({
        success: code === 0,
        output: stdout + stderr,
        duration,
        exitCode: code ?? -1,
        error: code !== 0 ? `Exit code: ${code}` : undefined,
      })
    })

    proc.on('error', (err) => {
      clearTimeout(timeoutId)
      resolve({
        success: false,
        output: stdout + stderr,
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
  timeout = DEFAULT_AGENT_TIMEOUT,
  executablePath,
  envPath,
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
    workDir = await createTempWorkDir()

    // 3. Create MCP config if enabled
    if (mcpConfig?.enabled) {
      mcpConfigPath = await createTempMCPConfig(workDir, mcpConfig)
    }

    // 4. Execute Claude Code CLI
    const result = await execClaude(prompt, workDir, timeout, executablePath, envPath)

    if (!result.success && !result.output) {
      // Return error as string for cross-process serialization
      return { ok: false as const, error: result.error || 'Claude Code execution failed' }
    }

    // 5. Run graders against output
    const graders = await loadGraders(evalPath)
    const graderResults = await runGraders(graders, result.output)
    const score = computeScore(graderResults)

    // 6. Return result
    return OK({
      score,
      debug: debug
        ? {
            prompt,
            response: result.output,
            graders: graderResults,
            transcript: buildTranscript(prompt, result, graderResults),
          }
        : undefined,
    })
  } catch (error) {
    // Return error as string for cross-process serialization
    const errorMessage = error instanceof Error ? error.message : String(error)
    return { ok: false as const, error: errorMessage }
  } finally {
    // Cleanup
    if (mcpConfigPath) {
      await cleanupTempMCPConfig(mcpConfigPath)
    }
    if (workDir) {
      await cleanupTempWorkDir(workDir)
    }
  }
}

/**
 * Build a debug transcript for agent execution.
 */
function buildTranscript(
  prompt: string,
  result: AgentExecResult,
  graderResults: [string, boolean][],
): string {
  const passed = graderResults.filter(([, p]) => p).length
  const scorePercent = ((passed / graderResults.length) * 100).toFixed(1)

  return `# Claude Code Agent Transcript

## Execution Info
- **Duration**: ${(result.duration / 1000).toFixed(2)}s
- **Exit Code**: ${result.exitCode}
- **Success**: ${result.success}

## Prompt
\`\`\`markdown
${prompt.trim()}
\`\`\`

## Output
\`\`\`
${result.output.slice(0, 10000)}${result.output.length > 10000 ? '\n... (truncated)' : ''}
\`\`\`

## Grader Results
**Score: ${scorePercent}%** (${passed}/${graderResults.length})

| Grader | Result |
|--------|--------|
${graderResults.map(([name, p]) => `| ${name} | ${p ? 'PASS' : 'FAIL'} |`).join('\n')}
`
}
