import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import type { Evaluation } from '@/src/interfaces'

export const DEFAULT_CLERK_SETUP_SKILL_PATH = 'skills/clerk-setup/SKILL.md'

/** The add-auth prompt revision when CLERK_SKILLS_SHA is unset. Bump it when clerk-setup changes. */
export const DEFAULT_CLERK_SKILLS_SHA = 'a02dbd2a933b8929525129a6cb9dcf6ed66d0adf'

const promptCache = new Map<string, Promise<string>>()

export function stripSkillFrontmatter(content: string): string {
  const prompt = content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n+/, '')

  if (prompt === content) {
    throw new Error('Expected YAML frontmatter in the canonical clerk-setup skill')
  }

  return prompt
}

export function isAddAuthEval(evalPath: string): boolean {
  return path.basename(evalPath) === 'add-auth'
}

export function getClerkSkillsSha(): string {
  return process.env.CLERK_SKILLS_SHA || DEFAULT_CLERK_SKILLS_SHA
}

/** The Skills revision a run evaluates: the add-auth prompt's revision, or an explicit request. */
export function getRequestedSkillsSha(
  evaluations: readonly Pick<Evaluation, 'path'>[],
): string | undefined {
  return evaluations.some((evaluation) => isAddAuthEval(evaluation.path))
    ? getClerkSkillsSha()
    : process.env.CLERK_SKILLS_SHA
}

function getSkillsRevision(revision = getClerkSkillsSha()): string {
  if (!revision || !/^[0-9a-f]{40}$/.test(revision)) {
    throw new Error('CLERK_SKILLS_SHA must be a full clerk/skills commit SHA for add-auth evals')
  }

  return revision
}

export async function loadCanonicalSetupPrompt(
  options: {
    revision?: string
    skillPath?: string
    fetchImpl?: (url: string) => Promise<Response>
  } = {},
): Promise<string> {
  const revision = getSkillsRevision(options.revision)
  const skillPath =
    options.skillPath ?? process.env.CLERK_SETUP_SKILL_PATH ?? DEFAULT_CLERK_SETUP_SKILL_PATH
  const key = `${revision}:${skillPath}`
  const load = async () => {
    const url = `https://raw.githubusercontent.com/clerk/skills/${revision}/${skillPath}`
    const response = await (options.fetchImpl ?? fetch)(url)

    if (!response.ok) {
      throw new Error(`Unable to fetch canonical clerk-setup skill (${response.status}): ${url}`)
    }

    return stripSkillFrontmatter(await response.text())
  }

  if (options.fetchImpl) return load()
  if (!promptCache.has(key)) {
    const pending = load().catch((error) => {
      promptCache.delete(key)
      throw error
    })
    promptCache.set(key, pending)
  }

  return promptCache.get(key)!
}

export async function loadEvaluationPrompt(evalPath: string): Promise<string> {
  if (isAddAuthEval(evalPath)) {
    return loadCanonicalSetupPrompt()
  }

  return fs.readFile(path.join(evalPath, 'PROMPT.md'), 'utf8')
}
