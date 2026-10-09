import { appendFile } from 'node:fs/promises'
import { getSkillsForEval } from '@/src/config/skills'

export type Column = 'baseline' | 'skills'

/** An unexpired workflow artifact. `harnessSha` is the clerk-evals commit its run used. */
export type Artifact = { name: string; createdAt: string; runId: number; harnessSha: string }

export type SkillsDiff = { status: string; files: string[]; truncated: boolean }

export type PlanInput = {
  sha: string
  cli: string
  agent: string
  harnessSha: string
  /** Manual force, and a future CLI-release trigger, always run both columns. */
  runBoth: boolean
  artifacts: readonly Artifact[]
  compare: (base: string, head: string) => Promise<SkillsDiff>
  skillDirs?: readonly string[]
}

export type Plan =
  | { skip: true; reason: string }
  | { skip: false; columns: Column[]; reason: string; baseline?: Artifact }

export const SETUP_SKILL_DIR = 'skills/clerk-setup/'

/** The Skills column loads only the skills mapped to add-auth, so only they can change its score. */
export function addAuthSkillDirs(): string[] {
  return getSkillsForEval('evals/add-auth').map((name) => `skills/${name}/`)
}

const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const newest = (artifacts: readonly Artifact[], pattern: RegExp) =>
  [...artifacts]
    .filter((artifact) => pattern.test(artifact.name))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]

const touches = (diff: SkillsDiff, dirs: readonly string[]) =>
  diff.files.some((file) => dirs.some((dir) => file.startsWith(dir)))

export function baselineArtifactName(sha: string, cli: string, agent: string): string {
  return `add-auth-baseline-${sha}-${cli}-cc${agent}`
}

export async function planAddAuthRun(input: PlanInput): Promise<Plan> {
  const { sha, cli, agent, artifacts, compare } = input
  const both = (reason: string): Plan => ({ skip: false, columns: ['baseline', 'skills'], reason })

  if (input.runBoth) return both('Forced run evaluates both columns')

  const names = new Set(artifacts.map((artifact) => artifact.name))
  if (
    names.has(`add-auth-skills-${sha}-${cli}`) &&
    names.has(`add-auth-comparison-${sha}-${cli}`)
  ) {
    return { skip: true, reason: `${sha} / ${cli} is already evaluated; use manual force to rerun` }
  }

  const last = newest(artifacts, /^add-auth-comparison-[0-9a-f]{40}-/)
  const [, lastSha, lastCli] = last?.name.match(/^add-auth-comparison-([0-9a-f]{40})-(.+)$/) ?? []
  if (!lastSha) return both('No earlier evaluation to compare against')
  if (lastCli !== cli) return both(`Clerk CLI changed from ${lastCli} to ${cli}`)

  const diff = await compare(lastSha, sha)
  if (diff.status !== 'ahead' || diff.truncated) {
    return both(`Can't tell what changed since ${lastSha} (${diff.status})`)
  }
  if (!touches(diff, input.skillDirs ?? addAuthSkillDirs())) {
    return { skip: true, reason: `No add-auth skill changed since ${lastSha}` }
  }

  // Baseline depends on the clerk-setup prompt, the CLI, the coding agent, and the harness.
  const baseline = newest(
    artifacts.filter((artifact) => artifact.harnessSha === input.harnessSha),
    new RegExp(`^add-auth-baseline-[0-9a-f]{40}-${escape(cli)}-cc${escape(agent)}$`),
  )
  const baselineSha = baseline?.name.match(/^add-auth-baseline-([0-9a-f]{40})-/)?.[1]
  if (baseline && baselineSha) {
    const setupDiff = baselineSha === lastSha ? diff : await compare(baselineSha, sha)
    const unchanged =
      (setupDiff.status === 'ahead' || setupDiff.status === 'identical') &&
      !setupDiff.truncated &&
      !touches(setupDiff, [SETUP_SKILL_DIR])
    if (unchanged) {
      return {
        skip: false,
        columns: ['skills'],
        baseline,
        reason: `Reusing the baseline from ${baselineSha} (run ${baseline.runId})`,
      }
    }
  }

  return both('No reusable baseline for this prompt, CLI, agent, and harness')
}

if (import.meta.main) {
  const { GH_TOKEN, GITHUB_REPOSITORY, GITHUB_SHA, GITHUB_OUTPUT, GITHUB_STEP_SUMMARY } =
    process.env
  const api = async <T>(route: string): Promise<T> => {
    const response = await fetch(`https://api.github.com/${route}`, {
      headers: { accept: 'application/vnd.github+json', authorization: `Bearer ${GH_TOKEN}` },
      signal: AbortSignal.timeout(30_000),
    })
    if (!response.ok) throw new Error(`GitHub API ${response.status}: ${route}`)
    return response.json() as Promise<T>
  }

  type ApiArtifact = {
    name: string
    expired: boolean
    created_at: string
    workflow_run: { id: number; head_sha: string }
  }
  const artifacts: Artifact[] = []
  for (let page = 1; page <= 10; page++) {
    const { artifacts: batch } = await api<{ artifacts: ApiArtifact[] }>(
      `repos/${GITHUB_REPOSITORY}/actions/artifacts?per_page=100&page=${page}`,
    )
    for (const artifact of batch) {
      if (artifact.expired || !artifact.name.startsWith('add-auth-')) continue
      artifacts.push({
        name: artifact.name,
        createdAt: artifact.created_at,
        runId: artifact.workflow_run.id,
        harnessSha: artifact.workflow_run.head_sha,
      })
    }
    if (batch.length < 100) break
  }

  const plan = await planAddAuthRun({
    sha: process.env.SKILLS_SHA ?? '',
    cli: process.env.CLI_VERSION ?? '',
    agent: process.env.AGENT_VERSION ?? '',
    harnessSha: GITHUB_SHA ?? '',
    runBoth: process.env.FORCE === 'true',
    artifacts,
    compare: async (base, head) => {
      const { status, files = [] } = await api<{ status: string; files?: { filename: string }[] }>(
        `repos/clerk/skills/compare/${base}...${head}`,
      )
      // The compare API lists at most 300 files.
      return { status, files: files.map((file) => file.filename), truncated: files.length >= 300 }
    },
  })

  const outputs = {
    skip: String(plan.skip),
    columns: JSON.stringify(plan.skip ? [] : plan.columns),
    baseline_run_id: plan.skip ? '' : String(plan.baseline?.runId ?? ''),
    baseline_name: plan.skip ? '' : (plan.baseline?.name ?? ''),
  }
  console.log(plan.reason, outputs)
  if (GITHUB_OUTPUT) {
    await appendFile(
      GITHUB_OUTPUT,
      Object.entries(outputs)
        .map(([key, value]) => `${key}=${value}\n`)
        .join(''),
    )
  }
  if (GITHUB_STEP_SUMMARY) {
    await appendFile(GITHUB_STEP_SUMMARY, `## Add-auth eval plan\n\n${plan.reason}\n`)
  }
}
