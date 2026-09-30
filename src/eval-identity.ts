import { execSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import type { Evaluation } from '@/src/interfaces'

export function getEvalKey(evaluation: Pick<Evaluation, 'path' | 'variant'>): string {
  return evaluation.variant ? `${evaluation.path}::${evaluation.variant}` : evaluation.path
}

async function readOptional(filePath: string): Promise<string> {
  try {
    return await readFile(filePath, 'utf8')
  } catch {
    return ''
  }
}

async function readDirectory(directory: string, relativeDir = ''): Promise<[string, string][]> {
  let entries
  try {
    entries = await readdir(directory, { withFileTypes: true })
  } catch {
    return []
  }

  const files: [string, string][] = []
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const absolutePath = path.join(directory, entry.name)
    const relativePath = path.join(relativeDir, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await readDirectory(absolutePath, relativePath)))
    } else {
      files.push([relativePath, await readOptional(absolutePath)])
    }
  }
  return files
}

export async function getSuiteHash(
  evaluations: Pick<Evaluation, 'path' | 'variant'>[],
  cwd = process.cwd(),
): Promise<string> {
  const hash = createHash('sha256')

  for (const evaluation of [...evaluations].sort((a, b) =>
    getEvalKey(a).localeCompare(getEvalKey(b)),
  )) {
    const evalDir = path.join(cwd, 'src', evaluation.path)

    hash.update(getEvalKey(evaluation))
    hash.update('\0')
    for (const [relativePath, content] of await readDirectory(evalDir)) {
      hash.update(relativePath)
      hash.update('\0')
      hash.update(content)
      hash.update('\0')
    }
  }

  for (const relativePath of [
    'src/graders/catalog.ts',
    'src/graders/index.ts',
    'src/runners/shared.ts',
    'src/scorers/llm.ts',
  ]) {
    hash.update(relativePath)
    hash.update('\0')
    hash.update(await readOptional(path.join(cwd, relativePath)))
    hash.update('\0')
  }

  return hash.digest('hex').slice(0, 12)
}

export function getGitCommit(cwd = process.cwd()): string | undefined {
  try {
    return execSync('git rev-parse HEAD', {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    return undefined
  }
}
