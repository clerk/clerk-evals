import { execSync } from 'node:child_process'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import type { Evaluation } from '@/src/interfaces'

export const DEFAULT_CLERK_SETUP_SKILL_PATH = 'skills/clerk-setup/SKILL.md'

/**
 * Eval runs are single-turn, so this answers the canonical skill's interactive steps up front.
 * Declining the skills install keeps the baseline column free of Clerk skills.
 */
export const ADD_AUTH_EVAL_CONTEXT = `The user approved your setup checklist but declined installing Clerk's agent skills. This session is non-interactive: skip any step that waits for the user's reply, and stop anything you start, such as a dev server, before you finish.`

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

export function readClerkSkillsMain(): string {
  try {
    return (
      execSync('git ls-remote https://github.com/clerk/skills.git refs/heads/main', {
        encoding: 'utf8',
        timeout: 15_000,
      }).split('\t')[0] ?? ''
    )
  } catch {
    throw new Error(
      'Unable to resolve clerk/skills main; set CLERK_SKILLS_SHA to a full commit SHA',
    )
  }
}

/**
 * Resolves the Skills revision a run evaluates, once, in the parent process. When add-auth runs
 * without CLERK_SKILLS_SHA, it pins clerk/skills main into the environment so every worker
 * fetches the same prompt the run records.
 */
export function resolveClerkSkillsSha(
  evaluations: readonly Pick<Evaluation, 'path'>[],
  readMain = readClerkSkillsMain,
): string | undefined {
  if (process.env.CLERK_SKILLS_SHA) return process.env.CLERK_SKILLS_SHA
  if (!evaluations.some((evaluation) => isAddAuthEval(evaluation.path))) return undefined

  const sha = getSkillsRevision(readMain())
  process.env.CLERK_SKILLS_SHA = sha
  return sha
}

function getSkillsRevision(revision = process.env.CLERK_SKILLS_SHA): string {
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

export function buildAddAuthPrompt(canonicalPrompt: string): string {
  return `${ADD_AUTH_EVAL_CONTEXT}\n\n---\n\n${canonicalPrompt}`
}

export async function loadEvaluationPrompt(evalPath: string): Promise<string> {
  if (isAddAuthEval(evalPath)) {
    return buildAddAuthPrompt(await loadCanonicalSetupPrompt())
  }

  return fs.readFile(path.join(evalPath, 'PROMPT.md'), 'utf8')
}
