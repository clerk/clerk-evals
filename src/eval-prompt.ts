import * as fs from 'node:fs/promises'
import * as path from 'node:path'

export const DEFAULT_CLERK_SETUP_SKILL_PATH = 'skills/clerk-setup/SKILL.md'

let canonicalSetupPrompt: Promise<string> | undefined

export function stripSkillFrontmatter(content: string): string {
  const prompt = content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n+/, '')

  if (prompt === content) {
    throw new Error('Expected YAML frontmatter in the canonical clerk-setup skill')
  }

  return prompt
}

function isAddAuthEval(evalPath: string): boolean {
  return path.basename(evalPath) === 'add-auth'
}

function getSkillsRevision(): string {
  const revision = process.env.CLERK_SKILLS_SHA
  if (!revision || !/^[0-9a-f]{40}$/.test(revision)) {
    throw new Error('CLERK_SKILLS_SHA must be a full clerk/skills commit SHA for add-auth evals')
  }

  return revision
}

export async function loadCanonicalSetupPrompt(): Promise<string> {
  canonicalSetupPrompt ??= (async () => {
    const revision = getSkillsRevision()
    const skillPath = process.env.CLERK_SETUP_SKILL_PATH ?? DEFAULT_CLERK_SETUP_SKILL_PATH
    const url = `https://raw.githubusercontent.com/clerk/skills/${revision}/${skillPath}`
    const response = await fetch(url)

    if (!response.ok) {
      throw new Error(`Unable to fetch canonical clerk-setup skill (${response.status}): ${url}`)
    }

    return stripSkillFrontmatter(await response.text())
  })()

  return canonicalSetupPrompt
}

export async function loadEvaluationPrompt(evalPath: string): Promise<string> {
  if (isAddAuthEval(evalPath)) {
    return loadCanonicalSetupPrompt()
  }

  return fs.readFile(path.join(evalPath, 'PROMPT.md'), 'utf8')
}
