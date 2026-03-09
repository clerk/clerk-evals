/**
 * Skills configuration for agent evaluations.
 *
 * Maps eval paths to relevant Openfort skills and injects them via CLAUDE.md.
 * Claude Code auto-loads CLAUDE.md in the working directory.
 */
import * as fs from 'node:fs/promises'
import * as path from 'node:path'

/**
 * Maps eval paths to relevant Openfort skills.
 * More accurate than category-based mapping since each eval has specific needs.
 * Skills must exist in the skills repo at skills/<name>/SKILL.md
 *
 * Currently empty — no Openfort skills repo yet.
 */
export const EVAL_SKILL_MAPPING: Record<string, string[]> = {}

/**
 * Get skill names for a given eval path.
 */
export function getSkillsForEval(evalPath: string): string[] {
  // Normalize path (remove leading src/ if present)
  const normalized = evalPath.replace(/^src\//, '')
  return EVAL_SKILL_MAPPING[normalized] || []
}

/**
 * Recursively read all markdown files from a skill directory.
 */
async function readSkillContent(skillDir: string): Promise<string> {
  const parts: string[] = []

  // Read main SKILL.md
  const skillMdPath = path.join(skillDir, 'SKILL.md')
  try {
    const content = await fs.readFile(skillMdPath, 'utf8')
    parts.push(content)
  } catch {
    return ''
  }

  // Read reference files if they exist
  const referencesDir = path.join(skillDir, 'references')
  try {
    const files = await fs.readdir(referencesDir)
    for (const file of files) {
      if (file.endsWith('.md')) {
        const refPath = path.join(referencesDir, file)
        const refContent = await fs.readFile(refPath, 'utf8')
        parts.push(`\n## Reference: ${file.replace('.md', '')}\n\n${refContent}`)
      }
    }
  } catch {
    // No references directory, that's fine
  }

  return parts.join('\n')
}

/**
 * Create CLAUDE.md with skill content for Claude Code auto-discovery.
 * Claude Code automatically loads CLAUDE.md from the working directory.
 *
 * @param evalPath - The evaluation path to get skills for (e.g., 'evals/wallets/create')
 * @param skillsSourcePath - Path to the skills repo (e.g., /path/to/skills/skills)
 * @param workDir - Temporary working directory for the eval
 * @returns Array of skill names that were successfully loaded
 */
export async function createSkillsClaudeMd(
  evalPath: string,
  skillsSourcePath: string,
  workDir: string,
): Promise<string[]> {
  const skillNames = getSkillsForEval(evalPath)
  const loadedSkills: string[] = []
  const skillContents: string[] = []

  // Header for CLAUDE.md
  skillContents.push(`# Openfort Skills Reference

**OUTPUT FORMAT**: Respond with fenced code blocks like:

\`\`\`typescript file="path/to/file.ts"
// code here
\`\`\`

Include ALL necessary files for a working app:
- Source files (pages, components, providers)
- package.json with @openfort/openfort-node or @openfort/openfort-js dependency
- .env.local with NEXT_PUBLIC_OPENFORT_PUBLISHABLE_KEY and OPENFORT_SECRET_KEY placeholders

Do NOT include prose explanations between code blocks.

---
`)

  for (const name of skillNames) {
    const skillDir = path.join(skillsSourcePath, name)

    try {
      const content = await readSkillContent(skillDir)
      if (content) {
        skillContents.push(`\n# Skill: ${name}\n\n${content}\n\n---\n`)
        loadedSkills.push(name)
      }
    } catch (err) {
      console.warn(`[skills] Failed to read skill "${name}": ${err}`)
    }
  }

  // Write CLAUDE.md
  if (loadedSkills.length > 0) {
    const claudeMdPath = path.join(workDir, 'CLAUDE.md')
    await fs.writeFile(claudeMdPath, skillContents.join('\n'))
  }

  return loadedSkills
}

/**
 * @deprecated Use createSkillsClaudeMd instead. Symlinks don't work in --print mode.
 */
export async function symlinkSkills(
  evalPath: string,
  skillsSourcePath: string,
  workDir: string,
): Promise<string[]> {
  return createSkillsClaudeMd(evalPath, skillsSourcePath, workDir)
}
