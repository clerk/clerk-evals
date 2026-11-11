import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { expect, test } from 'bun:test'
import { resolveProjectRoot } from './project-root'

test('resolves a single scaffolded project and rejects ambiguous roots', async () => {
  const workspace = await mkdtemp(path.join(tmpdir(), 'clerk-project-root-'))
  try {
    const first = path.join(workspace, 'my-clerk-next-app')
    await mkdir(first)
    await writeFile(path.join(first, 'package.json'), '{}')
    expect(resolveProjectRoot(workspace)).toBe(first)

    const second = path.join(workspace, 'another-app')
    await mkdir(second)
    await writeFile(path.join(second, 'package.json'), '{}')
    expect(() => resolveProjectRoot(workspace)).toThrow('Expected one Next.js project')

    await writeFile(path.join(workspace, 'package.json'), '{}')
    expect(resolveProjectRoot(workspace)).toBe(workspace)
  } finally {
    await rm(workspace, { recursive: true, force: true })
  }
})
