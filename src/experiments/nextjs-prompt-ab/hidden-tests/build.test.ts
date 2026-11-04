import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from 'bun:test'

test('the completed Next.js app builds', () => {
  const workspace = process.env.CLERK_EVAL_WORKSPACE
  if (!workspace) throw new Error('CLERK_EVAL_WORKSPACE is required')
  expect(existsSync(join(workspace, 'package.json'))).toBe(true)
  execFileSync('npm', ['run', 'build'], {
    cwd: workspace,
    env: { ...process.env, CI: '1', NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1' },
    encoding: 'utf8',
    timeout: 100_000,
    maxBuffer: 1_000_000,
  })
}, 110_000)
