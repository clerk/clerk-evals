import { mkdir, realpath, symlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { afterEach, describe, expect, test } from 'bun:test'
import { resolveAgentConfig } from './agent-config'
import { cleanupTempWorkDir, createTempWorkDir } from './runners/agents/shared'

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map(cleanupTempWorkDir))
})

async function temporaryDirectory(name: string): Promise<string> {
  const directory = await createTempWorkDir(name)
  temporaryDirectories.push(directory)
  return directory
}

describe('agent evaluation config', () => {
  test('resolves workspace and hidden test directories inside an evaluation', async () => {
    const evalDir = await temporaryDirectory('agent-config')
    await mkdir(path.join(evalDir, 'workspace'))
    await mkdir(path.join(evalDir, 'hidden-tests'))

    const resolved = await resolveAgentConfig(evalDir, {
      workspacePath: 'workspace',
      verification: { testsPath: 'hidden-tests' },
    })

    expect(resolved.workspacePath).toBe(await realpath(path.join(evalDir, 'workspace')))
    expect(resolved.verification?.testsPath).toBe(
      await realpath(path.join(evalDir, 'hidden-tests')),
    )
  })

  test('rejects lexical traversal', async () => {
    const evalDir = await temporaryDirectory('agent-config-traversal')

    expect(resolveAgentConfig(evalDir, { workspacePath: '../outside' })).rejects.toThrow(
      'escapes eval directory',
    )
  })

  test('rejects an absolute workspace path', async () => {
    const evalDir = await temporaryDirectory('agent-config-absolute')

    expect(
      resolveAgentConfig(evalDir, { workspacePath: path.join(evalDir, 'workspace') }),
    ).rejects.toThrow('must be eval-relative')
  })

  test('rejects a missing workspace directory', async () => {
    const evalDir = await temporaryDirectory('agent-config-missing')

    expect(resolveAgentConfig(evalDir, { workspacePath: 'workspace' })).rejects.toThrow(
      'does not exist',
    )
  })

  test('rejects a symlink that leaves the evaluation directory', async () => {
    const evalDir = await temporaryDirectory('agent-config-link')
    const outside = await temporaryDirectory('agent-config-outside')
    await symlink(outside, path.join(evalDir, 'workspace'))

    expect(resolveAgentConfig(evalDir, { workspacePath: 'workspace' })).rejects.toThrow(
      'through a symlink',
    )
  })

  test('rejects a file in place of a workspace directory', async () => {
    const evalDir = await temporaryDirectory('agent-config-file')
    await writeFile(path.join(evalDir, 'workspace'), 'not a directory')

    expect(resolveAgentConfig(evalDir, { workspacePath: 'workspace' })).rejects.toThrow(
      'is not a directory',
    )
  })
})
