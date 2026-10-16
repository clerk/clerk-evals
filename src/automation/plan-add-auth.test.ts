import { describe, expect, test } from 'bun:test'
import {
  type Artifact,
  baselineArtifactName,
  planAddAuthRun,
  type SkillsDiff,
} from './plan-add-auth'

const old = 'a'.repeat(40)
const next = 'b'.repeat(40)
const harness = 'h'.repeat(40)
const skillDirs = ['skills/clerk-setup/', 'skills/clerk-nextjs-patterns/']

const artifact = (name: string, overrides: Partial<Artifact> = {}): Artifact => ({
  name,
  createdAt: '2026-10-01T00:00:00Z',
  runId: 1,
  harnessSha: harness,
  ...overrides,
})
const evaluated = (sha: string, cli = '1.0.0', agent = '2.0.0') => [
  artifact(baselineArtifactName(sha, cli, agent), { runId: 7 }),
  artifact(`add-auth-skills-${sha}-${cli}`),
  artifact(`add-auth-comparison-${sha}-${cli}`),
]
const changed =
  (...files: string[]) =>
  async (): Promise<SkillsDiff> => ({
    status: 'ahead',
    files,
    truncated: false,
  })
const plan = (overrides: Partial<Parameters<typeof planAddAuthRun>[0]> = {}) =>
  planAddAuthRun({
    sha: next,
    cli: '1.0.0',
    agent: '2.0.0',
    harnessSha: harness,
    runBoth: false,
    artifacts: evaluated(old),
    compare: changed('skills/clerk-nextjs-patterns/SKILL.md'),
    skillDirs,
    ...overrides,
  })

describe('add-auth run plan', () => {
  test('skips when no add-auth skill changed since the last evaluation', async () => {
    expect(await plan({ compare: changed('skills/clerk-orgs/SKILL.md') })).toMatchObject({
      skip: true,
    })
  })

  test('reuses the stored baseline when only a variant skill changed', async () => {
    expect(await plan()).toMatchObject({
      skip: false,
      columns: ['skills'],
      baseline: { name: baselineArtifactName(old, '1.0.0', '2.0.0'), runId: 7 },
    })
  })

  test('runs both columns when the setup prompt changed', async () => {
    expect(await plan({ compare: changed('skills/clerk-setup/SKILL.md') })).toMatchObject({
      columns: ['baseline', 'skills'],
    })
  })

  test('runs both columns when the baseline came from another agent or harness', async () => {
    expect(await plan({ agent: '2.1.0' })).toMatchObject({ columns: ['baseline', 'skills'] })
    expect(await plan({ harnessSha: 'f'.repeat(40) })).toMatchObject({
      columns: ['baseline', 'skills'],
    })
  })

  test('runs both columns without history, after a CLI change, or when force is set', async () => {
    expect(await plan({ artifacts: [] })).toMatchObject({ columns: ['baseline', 'skills'] })
    expect(await plan({ cli: '1.1.0' })).toMatchObject({ columns: ['baseline', 'skills'] })
    expect(await plan({ runBoth: true, artifacts: evaluated(next) })).toMatchObject({
      columns: ['baseline', 'skills'],
    })
  })

  test('runs both columns when the diff is unclear', async () => {
    const unclear =
      (status: string, truncated = false) =>
      async () => ({
        status,
        files: [],
        truncated,
      })
    expect(await plan({ compare: unclear('behind') })).toMatchObject({ skip: false })
    expect(await plan({ compare: unclear('diverged') })).toMatchObject({ skip: false })
    expect(await plan({ compare: unclear('ahead', true) })).toMatchObject({ skip: false })
  })

  test('skips a revision that is already evaluated', async () => {
    expect(await plan({ artifacts: evaluated(next) })).toMatchObject({ skip: true })
  })
})
