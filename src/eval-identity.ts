import { execSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
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

export async function getSuiteHash(
  evaluations: Pick<Evaluation, 'path' | 'variant'>[],
  cwd = process.cwd(),
): Promise<string> {
  const hash = createHash('sha256')

  for (const evaluation of [...evaluations].sort((a, b) =>
    getEvalKey(a).localeCompare(getEvalKey(b)),
  )) {
    const evalDir = path.join(cwd, 'src', evaluation.path)
    const prompt = await readOptional(path.join(evalDir, 'PROMPT.md'))
    const graders = await readOptional(
      evaluation.variant
        ? path.join(evalDir, 'graders', `${evaluation.variant}.ts`)
        : path.join(evalDir, 'graders.ts'),
    )

    hash.update(getEvalKey(evaluation))
    hash.update('\0')
    hash.update(prompt)
    hash.update('\0')
    hash.update(graders)
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
