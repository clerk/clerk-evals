import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from 'bun:test'

function resolveProjectRoot(workspace: string): string {
  if (existsSync(join(workspace, 'package.json'))) return workspace
  const projects = readdirSync(workspace, { withFileTypes: true })
    .filter(
      (entry) => entry.isDirectory() && existsSync(join(workspace, entry.name, 'package.json')),
    )
    .map((entry) => join(workspace, entry.name))
  expect(projects).toHaveLength(1)
  return projects[0]!
}

test('the completed Next.js app builds', () => {
  const workspace = process.env.CLERK_EVAL_WORKSPACE
  if (!workspace) throw new Error('CLERK_EVAL_WORKSPACE is required')
  const projectRoot = resolveProjectRoot(workspace)
  execFileSync('npm', ['run', 'build'], {
    cwd: projectRoot,
    env: { ...process.env, CI: '1', NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1' },
    encoding: 'utf8',
    timeout: 100_000,
    maxBuffer: 1_000_000,
  })
}, 110_000)
