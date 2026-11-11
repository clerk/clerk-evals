import { execFileSync } from 'node:child_process'
import {
  appendFile,
  chmod,
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  writeFile,
} from 'node:fs/promises'
import { existsSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { requireGatewayCredential } from '@/src/gateway'
import { buildAgentPrompt, buildAgentTranscript } from '@/src/runners/agents/shared'
import type { AgentExecResult, AgentRunnerArgs, AgentType } from '@/src/interfaces/agent'
import type { RunnerResult } from '@/src/interfaces'
import {
  AGENTS,
  CRITICAL_CHECKS,
  ARMS,
  FIXTURES,
  cellKey,
  loadPromptPair,
  planCells,
  summarizeCells,
  type Arm,
  type CellResult,
  type Fixture,
} from './experiment'

type ExperimentRecord = {
  schemaVersion: 1
  docsSha: string
  promptHashes: Record<Arm, string>
  cliVersion: string
  agentModels: Record<AgentType, string>
  agentVersions: Record<AgentType, string>
  runsPerCell: number
  startedAt: string
  results: CellResult[]
  /** All claim files ever captured, including attempts later replaced by --resume. */
  claimFiles?: string[]
}

const { values } = parseArgs({
  args: Bun.argv,
  options: {
    'docs-sha': { type: 'string' },
    'docs-repo': { type: 'string' },
    'claude-model': { type: 'string' },
    'codex-model': { type: 'string' },
    runs: { type: 'string' },
    output: { type: 'string' },
    resume: { type: 'boolean', default: false },
    'dry-run': { type: 'boolean', default: false },
    'acknowledge-app-creation': { type: 'boolean', default: false },
    'keep-workspaces': { type: 'boolean', default: false },
  },
  strict: true,
  allowPositionals: true,
})

function commandOutput(file: string, args: string[]): string {
  return execFileSync(file, args, { encoding: 'utf8', timeout: 20_000 }).trim()
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function promptFor(fixture: Fixture, prompt: string): string {
  const fixtureContext =
    fixture === 'empty'
      ? 'This directory is empty. The user chose Next.js and npm for the new application.'
      : `This is an existing Next.js ${fixture === 'next15' ? '15' : '16'} project. Preserve its framework version.`
  return [
    'The user has approved the setup checklist. This is a non-interactive evaluation: do not wait for another reply. Stop any dev server before finishing.',
    fixtureContext,
    'The following is the Clerk setup prompt:',
    prompt,
  ].join('\n\n---\n\n')
}

async function readExisting(file: string): Promise<ExperimentRecord | undefined> {
  try {
    return JSON.parse(await readFile(file, 'utf8')) as ExperimentRecord
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
    throw error
  }
}

async function save(file: string, record: ExperimentRecord): Promise<void> {
  const pending = `${file}.tmp`
  await writeFile(pending, `${JSON.stringify(record, null, 2)}\n`)
  await rename(pending, file)
}

function assertResumeMatches(existing: ExperimentRecord, expected: ExperimentRecord): void {
  if (existing.schemaVersion !== expected.schemaVersion) {
    throw new Error('Cannot resume: results schema changed')
  }
  for (const field of ['docsSha', 'cliVersion', 'runsPerCell'] as const) {
    if (existing[field] !== expected[field]) throw new Error(`Cannot resume: ${field} changed`)
  }
  for (const field of ['promptHashes', 'agentModels', 'agentVersions'] as const) {
    if (JSON.stringify(existing[field]) !== JSON.stringify(expected[field])) {
      throw new Error(`Cannot resume: ${field} changed`)
    }
  }
}

if (
  !values['docs-sha'] ||
  !values['docs-repo'] ||
  !values['claude-model'] ||
  !values['codex-model']
) {
  throw new Error(
    'Required: --docs-sha <full SHA> --docs-repo <local clerk/clerk checkout> --claude-model <model> --codex-model <model>',
  )
}
const runs = values.runs ? Number(values.runs) : 5
const cells = planCells(runs)
const output = path.resolve(values.output ?? 'nextjs-prompt-ab-results.json')
const docsSha = values['docs-sha']
const prompts = loadPromptPair(docsSha, path.resolve(values['docs-repo']))
const cliVersion = commandOutput('npm', ['view', 'clerk@latest', 'version', '--prefer-online'])
const agentModels = {
  'claude-code': values['claude-model'],
  codex: values['codex-model'],
}
const agentVersions = {
  'claude-code': commandOutput('claude', ['--version']),
  codex: commandOutput('codex', ['--version']),
}
const expected: ExperimentRecord = {
  schemaVersion: 1,
  docsSha,
  promptHashes: { dedicated: prompts.dedicated.sha256, shared: prompts.shared.sha256 },
  cliVersion,
  agentModels,
  agentVersions,
  runsPerCell: runs,
  startedAt: new Date().toISOString(),
  results: [],
  claimFiles: [],
}

console.log(`Pinned Docs: ${docsSha}`)
console.log(`Pinned prompt hashes: ${JSON.stringify(expected.promptHashes)}`)
console.log(`Current clerk@latest: ${cliVersion}`)
console.log(
  `Plan: ${cells.length} runs across ${AGENTS.length} agents, ${FIXTURES.length} fixtures, and ${ARMS.length} prompts`,
)

if (values['dry-run']) process.exit(0)
if (!values['acknowledge-app-creation']) {
  throw new Error(
    'These runs can create real accountless Clerk apps. Pass --acknowledge-app-creation after arranging cleanup.',
  )
}
requireGatewayCredential()

const existing = await readExisting(output)
if (existing && !values.resume)
  throw new Error(`Output exists: ${output}. Use --resume or choose another --output.`)
if (existing) assertResumeMatches(existing, expected)
const record = existing ?? expected
if (!existing) await save(output, record)
const completedKeys = new Set(
  record.results.filter((result) => result.status === 'completed').map(cellKey),
)

const experimentPath = path.join(process.cwd(), 'src/experiments/nextjs-prompt-ab')
const evalPath = path.join(process.cwd(), 'src/evals/add-auth')
const claimsDirectory = path.resolve('nextjs-prompt-ab-claims')
const transcriptsDirectory = path.resolve('nextjs-prompt-ab-transcripts')
const runners = {
  'claude-code': (await import('@/src/runners/agents/claude-code')).default,
  codex: (await import('@/src/runners/agents/codex')).default,
}

for (const cell of cells) {
  if (completedKeys.has(cellKey(cell))) continue
  if (commandOutput('npm', ['view', 'clerk@latest', 'version', '--prefer-online']) !== cliVersion) {
    throw new Error(
      'clerk@latest changed during the experiment. Stop and start a new pinned comparison.',
    )
  }
  if (
    commandOutput(cell.agent === 'claude-code' ? 'claude' : 'codex', ['--version']) !==
    agentVersions[cell.agent]
  ) {
    throw new Error(
      `${cell.agent} changed version during the experiment. Stop and start a new comparison.`,
    )
  }

  const workspacePath =
    cell.fixture === 'next15'
      ? path.join(evalPath, 'fixtures/nextjs')
      : cell.fixture === 'next16'
        ? path.join(experimentPath, 'fixtures/next16')
        : undefined
  const promptOverride = promptFor(cell.fixture, prompts[cell.arm].content)
  const fullPrompt = await buildAgentPrompt(evalPath, promptOverride)
  const claimFiles: string[] = []
  let preservedWorkspace: string | undefined
  let transcriptFile: string | undefined
  let agentTimedOut = false
  let provisioningFailed = false
  let errorTokens: CellResult['tokens']
  let executionEvidence: AgentExecResult | undefined
  const preliminaryTranscript = (execution: AgentExecResult): string =>
    buildAgentTranscript({
      agentLabel: cell.agent,
      prompt: fullPrompt,
      result: execution,
      graderResults: [],
      gradingArtifact: `## Final response\n\n${execution.output}`,
    })
  const writeTranscript = async (content: string): Promise<void> => {
    if (!transcriptFile) {
      await mkdir(transcriptsDirectory, { recursive: true, mode: 0o700 })
      const transcriptDirectory = await mkdtemp(
        path.join(transcriptsDirectory, `${cellKey(cell).replaceAll(':', '-')}-`),
      )
      await chmod(transcriptDirectory, 0o700)
      transcriptFile = path.join(transcriptDirectory, 'transcript.md')
    }
    await writeFile(transcriptFile, content, { mode: 0o600 })
  }
  const args: AgentRunnerArgs = {
    agent: cell.agent,
    evalPath,
    promptOverride,
    model: agentModels[cell.agent],
    executablePath: commandOutput('which', [cell.agent === 'claude-code' ? 'claude' : 'codex']),
    envPath: process.env.PATH ?? '',
    workspacePath,
    gradersPath: path.join(experimentPath, 'graders', `${cell.fixture}.ts`),
    verification: { testsPath: path.join(experimentPath, 'hidden-tests') },
    preserveWorkspace: values['keep-workspaces'],
    captureTranscript: true,
    onWorkspaceReady: async (workDir, execution) => {
      if (values['keep-workspaces']) preservedWorkspace = workDir
      executionEvidence = execution
      agentTimedOut = execution.timedOut ?? false
      errorTokens = execution.tokens
      const candidateProjects = [
        workDir,
        ...readdirSync(workDir, { withFileTypes: true })
          .filter((entry) => entry.isDirectory())
          .map((entry) => path.join(workDir, entry.name)),
      ]
      const keylessFiles = candidateProjects
        .flatMap((project) => [
          path.join(project, '.clerk/keyless.json'),
          path.join(project, '.clerk/.tmp/keyless.json'),
        ])
        .filter(existsSync)
      if (keylessFiles.length) {
        await mkdir(claimsDirectory, { recursive: true, mode: 0o700 })
        const claimDirectory = await mkdtemp(
          path.join(claimsDirectory, `${cellKey(cell).replaceAll(':', '-')}-`),
        )
        await chmod(claimDirectory, 0o700)
        for (const [index, keyless] of keylessFiles.entries()) {
          const claimFile = path.join(claimDirectory, `keyless-${index + 1}.json`)
          await copyFile(keyless, claimFile)
          await chmod(claimFile, 0o600)
          claimFiles.push(claimFile)
        }
      }
      await writeTranscript(preliminaryTranscript(execution))
      // A missing breadcrumb alone can be caused by the agent's command or scaffold.
      // Only the CLI's own provisioning warning justifies an infrastructure error.
      const provisioned = candidateProjects.some(
        (project) =>
          existsSync(path.join(project, '.clerk/keyless.json')) &&
          existsSync(path.join(project, '.env.local')),
      )
      provisioningFailed = Boolean(execution.provisioningWarning && !provisioned)
      if (provisioningFailed) {
        throw new Error('Clerk CLI reported development-key provisioning failure')
      }
    },
  }

  console.log(`[start] ${cellKey(cell)}`)
  const started = Date.now()
  let result: RunnerResult
  try {
    result = await runners[cell.agent](args)
  } catch (error) {
    result = { ok: false, error: errorMessage(error) }
  }
  if (result.ok && result.value.debug?.transcript) {
    await writeTranscript(result.value.debug.transcript)
  }
  if (!result.ok) {
    const failure = errorMessage(result.error)
    if (!transcriptFile) {
      await writeTranscript(
        executionEvidence
          ? preliminaryTranscript(executionEvidence)
          : `# ${cell.agent} trial\n\n## Prompt\n\n${fullPrompt}\n`,
      )
    }
    await appendFile(transcriptFile!, `\n## Trial error\n${failure}\n`)
  }
  const timedOutFailure =
    !result.ok &&
    agentTimedOut &&
    !provisioningFailed &&
    /^Timeout after \d+ms$/.test(errorMessage(result.error))
  const entry: CellResult = result.ok
    ? {
        ...cell,
        status: 'completed',
        score: result.value.score,
        graders: Object.fromEntries(result.value.graderResults ?? []),
        durationMs: Date.now() - started,
        claimFiles,
        workspace: preservedWorkspace,
        tokens: result.value.tokens,
        transcriptFile,
      }
    : timedOutFailure
      ? {
          ...cell,
          status: 'completed',
          score: 0,
          graders: Object.fromEntries(CRITICAL_CHECKS.map((name) => [name, false])),
          error: errorMessage(result.error),
          durationMs: Date.now() - started,
          claimFiles,
          workspace: preservedWorkspace,
          tokens: errorTokens,
          transcriptFile,
        }
      : {
          ...cell,
          status: 'error',
          error: errorMessage(result.error),
          durationMs: Date.now() - started,
          claimFiles,
          workspace: preservedWorkspace,
          tokens: errorTokens,
          transcriptFile,
        }
  record.results = record.results.filter((result) => cellKey(result) !== cellKey(cell))
  record.results.push(entry)
  record.claimFiles = [...new Set([...(record.claimFiles ?? []), ...claimFiles])]
  await save(output, record)
  console.log(
    `[done] ${cellKey(cell)}: ${entry.status}${entry.score === undefined ? '' : ` ${entry.score.toFixed(2)}`}`,
  )
}

for (const agent of AGENTS) {
  for (const fixture of FIXTURES) {
    const dedicated = summarizeCells(
      record.results.filter(
        (result) =>
          result.agent === agent && result.fixture === fixture && result.arm === 'dedicated',
      ),
    )
    const shared = summarizeCells(
      record.results.filter(
        (result) => result.agent === agent && result.fixture === fixture && result.arm === 'shared',
      ),
    )
    console.log(
      `${agent}/${fixture}: dedicated=${JSON.stringify(dedicated)} shared=${JSON.stringify(shared)}`,
    )
  }
}
console.log(`Results: ${output}`)
console.log(
  'Review per-grader differences and clean up accountless apps before making a prompt decision.',
)
if (record.results.some((result) => result.status === 'error')) process.exitCode = 1
