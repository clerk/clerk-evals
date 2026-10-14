import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import type { AgentType } from '@/src/interfaces/agent'

export const DOCS_PROMPT_PATHS = {
  dedicated: 'clerk-docs/prompts/nextjs-quickstart.md',
  shared: 'clerk-docs/prompts/cli-setup.md',
} as const

export type Arm = keyof typeof DOCS_PROMPT_PATHS
export type Fixture = 'next15' | 'next16' | 'empty'
export const FIXTURES: readonly Fixture[] = ['next15', 'next16', 'empty']
export const ARMS: readonly Arm[] = ['dedicated', 'shared']
export const AGENTS: readonly AgentType[] = ['claude-code', 'codex']

export type Cell = { arm: Arm; fixture: Fixture; agent: AgentType; trial: number }
export type CellResult = Cell & {
  status: 'completed' | 'error'
  score?: number
  graders?: Record<string, boolean>
  durationMs: number
  error?: string
}

export function assertFullSha(value: string): void {
  if (!/^[0-9a-f]{40}$/.test(value)) {
    throw new Error('Provide a full 40-character clerk/clerk commit SHA with --docs-sha')
  }
}

export function planCells(runs: number): Cell[] {
  if (!Number.isSafeInteger(runs) || runs < 1) {
    throw new Error('--runs must be a positive integer')
  }

  const cells: Cell[] = []
  for (const agent of AGENTS) {
    for (const fixture of FIXTURES) {
      for (let trial = 1; trial <= runs; trial++) {
        // Interleave A and B to avoid comparing different times of day or CLI versions.
        for (const arm of trial % 2 === 0 ? [...ARMS].reverse() : ARMS) {
          cells.push({ agent, fixture, trial, arm })
        }
      }
    }
  }
  return cells
}

export function cellKey(cell: Cell): string {
  return `${cell.agent}:${cell.fixture}:${cell.trial}:${cell.arm}`
}

export function loadPromptPair(
  docsSha: string,
  docsRepo: string,
  readFile: (repository: string, revision: string, filePath: string) => string = readGitFile,
): Record<Arm, { content: string; sha256: string }> {
  assertFullSha(docsSha)
  const entries = ARMS.map((arm) => {
    const content = readFile(docsRepo, docsSha, DOCS_PROMPT_PATHS[arm]).trim()
    if (!content) throw new Error(`${arm} prompt at ${docsSha} is empty`)
    return [arm, { content, sha256: createHash('sha256').update(content).digest('hex') }] as const
  })
  return Object.fromEntries(entries) as Record<Arm, { content: string; sha256: string }>
}

function readGitFile(repository: string, revision: string, filePath: string): string {
  try {
    return execFileSync('git', ['-C', repository, 'show', `${revision}:${filePath}`], {
      encoding: 'utf8',
      timeout: 15_000,
      maxBuffer: 2_000_000,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch {
    throw new Error(
      `Could not read ${filePath} at ${revision} from ${repository}. Fetch that commit into the local clerk/clerk checkout first.`,
    )
  }
}

export type CellSummary = {
  completed: number
  errors: number
  meanScore: number | null
  passRate: number | null
  graderPassRates: Record<string, number>
}

export function summarizeCells(results: readonly CellResult[]): CellSummary {
  const completed = results.filter((result) => result.status === 'completed')
  const graderNames = new Set(completed.flatMap((result) => Object.keys(result.graders ?? {})))
  const graderPassRates = Object.fromEntries(
    [...graderNames].map((name) => [
      name,
      completed.filter((result) => result.graders?.[name] === true).length / completed.length,
    ]),
  )
  return {
    completed: completed.length,
    errors: results.length - completed.length,
    meanScore: completed.length
      ? completed.reduce((sum, result) => sum + (result.score ?? 0), 0) / completed.length
      : null,
    passRate: completed.length
      ? completed.filter((result) => Object.values(result.graders ?? {}).every(Boolean)).length /
        completed.length
      : null,
    graderPassRates,
  }
}
