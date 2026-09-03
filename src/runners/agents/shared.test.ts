import { mkdir, symlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { afterEach, describe, expect, test } from 'bun:test'
import { cleanupTempWorkDir, createTempWorkDir, snapshotWorkDir } from './shared'

const workDirs: string[] = []

afterEach(async () => {
  await Promise.all(workDirs.splice(0).map(cleanupTempWorkDir))
})

describe('agent workspace isolation', () => {
  test('creates workspaces outside the evaluation repository', async () => {
    const workDir = await createTempWorkDir('isolation')
    workDirs.push(workDir)
    expect(workDir.startsWith(process.cwd())).toBe(false)
  })

  test('snapshots final source files without secrets or harness context', async () => {
    const workDir = await createTempWorkDir('snapshot')
    workDirs.push(workDir)
    await mkdir(path.join(workDir, 'src'))
    await writeFile(path.join(workDir, 'src', 'app.tsx'), '<Show when="signed-in" />')
    await writeFile(path.join(workDir, '.env.local'), 'CLERK_SECRET_KEY=secret')
    await symlink(path.join(workDir, '.env.local'), path.join(workDir, 'linked-secret'))
    await writeFile(path.join(workDir, 'AGENTS.md'), 'hidden harness instructions')

    const snapshot = await snapshotWorkDir(workDir)
    expect(snapshot).toContain('src/app.tsx')
    expect(snapshot).toContain('<Show when="signed-in" />')
    expect(snapshot).not.toContain('CLERK_SECRET_KEY')
    expect(snapshot).not.toContain('linked-secret')
    expect(snapshot).not.toContain('hidden harness instructions')
  })
})
