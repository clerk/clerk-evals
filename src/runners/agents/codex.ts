/**
 * Codex Agent Runner
 *
 * Spawns the Codex CLI (codex exec) to execute evaluations.
 * Uses --json flag to capture JSONL events including tool calls and file writes.
 *
 * Key differences from Claude Code:
 * - Uses `codex exec` subcommand (non-interactive)
 * - Full-auto sandbox permissions for disk writes
 * - JSONL event stream via --json flag
 * - Context file: AGENTS.md (via setupAgentContext)
 */
import { execSync, spawn } from 'node:child_process'
import path from 'node:path'
import type { Graders } from '@/src/graders'
import type { RunnerResult } from '@/src/interfaces'
import type { AgentExecResult, AgentRunnerArgs } from '@/src/interfaces/agent'
import { computeScore, runGraders } from '@/src/runners/shared'
import { OK } from '@/src/utils/result'
import {
  buildAgentPrompt,
  cleanupTempWorkDir,
  copyFixtures,
  createTempWorkDir,
  DEFAULT_AGENT_TIMEOUT,
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
 * Parse Codex JSONL output into the full conversation text for grading.
 *
 * Extracts:
 * - Agent messages (item.type === "agent_message")
 * - Command outputs (item.type === "command_execution")
 * - File edits/writes (item.type === "file_edit" or "file_create")
 */
function parseCodexJsonl(raw: string): string {
  const parts: string[] = []

  for (const line of raw.split('\n')) {
    if (!line.trim()) continue
    let event: CodexJsonEvent
    try {
      event = JSON.parse(line)
    } catch {
      // Non-JSON output lines are plain text from the agent
      parts.push(line)
      continue
    }

    const item = event.item
    if (!item) continue

    // Agent text messages
    if (item.type === 'agent_message' && item.text) {
      parts.push(item.text)
    }

    // Command execution outputs (shell commands the agent ran)
    if (item.type === 'command_execution' && item.aggregated_output) {
      parts.push(item.aggregated_output)
    }

    // File writes/edits - capture the content
    if ((item.type === 'file_edit' || item.type === 'file_create') && item.file_path) {
      const content = item.new_content ?? item.content ?? ''
      if (content) {
        parts.push(`${item.file_path}\n${content}`)
      }
    }
  }

  return parts.join('\n\n')
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
): Promise<AgentExecResult> {
  const startTime = Date.now()

  return new Promise((resolve) => {
    const args = ['exec', '--json', '--ephemeral', '--full-auto', prompt]

    const proc = spawn(executablePath, args, {
      cwd: workDir,
      env: {
        ...process.env,
        PATH: envPath,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let stdout = ''

    proc.stdout.on('data', (data: Buffer) => {
      stdout += data.toString()
    })

    // stderr is ignored for grading
    proc.stderr.on('data', () => {})

    const timeoutId = setTimeout(() => {
      proc.kill('SIGTERM')
      const fullOutput = parseCodexJsonl(stdout)
      resolve({
        success: false,
        output: fullOutput,
        duration: Date.now() - startTime,
        error: `Timeout after ${timeout}ms`,
        exitCode: -1,
      })
    }, timeout)

    proc.on('close', (code) => {
      clearTimeout(timeoutId)
      const duration = Date.now() - startTime
      const fullOutput = parseCodexJsonl(stdout)

      resolve({
        success: code === 0,
        output: fullOutput,
        duration,
        exitCode: code ?? -1,
        error: code !== 0 ? `Exit code: ${code}` : undefined,
      })
    })

    proc.on('error', (err) => {
      clearTimeout(timeoutId)
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
  timeout = DEFAULT_AGENT_TIMEOUT,
  executablePath,
  envPath,
  fixturesPath,
  gradersPath,
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
    if (fixturesPath) {
      await copyFixtures(workDir, fixturesPath)
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
    const result = await execCodex(prompt, workDir, timeout, executablePath, envPath)

    if (!result.success && !result.output) {
      return { ok: false as const, error: result.error || 'Codex execution failed' }
    }

    // 5. Run graders against output (variant-aware)
    const graderModule = gradersPath
      ? ((await import(gradersPath)) as { graders: Graders })
      : ((await import(path.join(evalPath, 'graders.ts'))) as { graders: Graders })
    const graderResults = await runGraders(graderModule.graders, result.output)
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

/**
 * Build a debug transcript for Codex execution.
 */
function buildTranscript(
  prompt: string,
  result: AgentExecResult,
  graderResults: [string, boolean][],
): string {
  const passed = graderResults.filter(([, p]) => p).length
  const scorePercent = ((passed / graderResults.length) * 100).toFixed(1)

  return `# Codex Agent Transcript

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
