import { execFileSync } from 'node:child_process'
import { readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { requireGatewayCredential } from '@/src/gateway'
import type { AgentRunnerArgs, AgentType } from '@/src/interfaces/agent'
import type { RunnerResult } from '@/src/interfaces'
import {
  AGENTS,
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

function promptFor(arm: Arm, fixture: Fixture, prompt: string): string {
  const fixtureContext =
    fixture === 'empty'
      ? 'This directory is empty. The user chose Next.js and npm for the new application.'
      : `This is an existing Next.js ${fixture === 'next15' ? '15' : '16'} project. Preserve its framework version.`
  return [
    'The user has approved the setup checklist. This is a non-interactive evaluation: do not wait for another reply. Stop any dev server before finishing.',
    fixtureContext,
    `The following is the ${arm === 'dedicated' ? 'dedicated Next.js' : 'shared'} Clerk setup prompt:`,
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
  const args: AgentRunnerArgs = {
    agent: cell.agent,
    evalPath,
    promptOverride: promptFor(cell.arm, cell.fixture, prompts[cell.arm].content),
    isolatedHome: true,
    model: agentModels[cell.agent],
    executablePath: commandOutput('which', [cell.agent === 'claude-code' ? 'claude' : 'codex']),
    envPath: process.env.PATH ?? '',
    workspacePath,
    gradersPath: path.join(experimentPath, 'graders', `${cell.fixture}.ts`),
    verification: { testsPath: path.join(experimentPath, 'hidden-tests') },
  }

  console.log(`[start] ${cellKey(cell)}`)
  const started = Date.now()
  let result: RunnerResult
  try {
    result = await runners[cell.agent](args)
  } catch (error) {
    result = { ok: false, error: errorMessage(error) }
  }
  const entry: CellResult = result.ok
    ? {
        ...cell,
        status: 'completed',
        score: result.value.score,
        graders: Object.fromEntries(result.value.graderResults ?? []),
        durationMs: Date.now() - started,
      }
    : {
        ...cell,
        status: 'error',
        error: errorMessage(result.error),
        durationMs: Date.now() - started,
      }
  record.results = record.results.filter((result) => cellKey(result) !== cellKey(cell))
  record.results.push(entry)
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
