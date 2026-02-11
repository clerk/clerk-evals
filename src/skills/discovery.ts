/**
 * Skill discovery and loading following the Agent Skills pattern.
 *
 * Scans a skills directory for SKILL.md files, extracts metadata (name, description)
 * from frontmatter for progressive disclosure, and loads full content on demand.
 *
 * @see https://ai-sdk.dev/cookbook/guides/agent-skills
 */
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import matter from 'gray-matter'
import type { SkillMetadata } from '@/src/interfaces'

/**
 * Parse YAML frontmatter from SKILL.md content.
 * Uses gray-matter for robust YAML parsing.
 */
export function parseFrontmatter(content: string): { name: string; description: string } {
  const { data } = matter(content)
  if (!data.name || !data.description) {
    throw new Error('Frontmatter must include name and description')
  }
  return {
    name: data.name,
    description: data.description,
  }
}

/**
 * Strip YAML frontmatter from content, returning only the body.
 * Uses gray-matter for consistent parsing.
 */
export function stripFrontmatter(content: string): string {
  const { content: body } = matter(content)
  return body.trim()
}

/**
 * Discover all skills in a directory.
 * Scans for subdirectories containing a valid SKILL.md with name and description.
 */
export async function discoverSkills(skillsPath: string): Promise<SkillMetadata[]> {
  const skills: SkillMetadata[] = []

  let entries: Awaited<ReturnType<typeof fs.readdir>>
  try {
    entries = await fs.readdir(skillsPath, { withFileTypes: true })
  } catch {
    return []
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue

    const skillDir = path.join(skillsPath, entry.name)
    const skillFile = path.join(skillDir, 'SKILL.md')

    try {
      const content = await fs.readFile(skillFile, 'utf8')
      const frontmatter = parseFrontmatter(content)

      if (frontmatter.name && frontmatter.description) {
        skills.push({
          name: frontmatter.name,
          description: frontmatter.description,
          path: skillDir,
        })
      }
    } catch {}
  }

  return skills
}

/**
 * Load full skill content: SKILL.md body (without frontmatter) + all references/*.md.
 *
 * Reference expansion follows the Agent Skills specification:
 * @see https://agentskills.io/specification#references/
 *
 * Why expand references:
 * - Skills can include external reference materials (API docs, code examples, guides)
 * - The `references/` directory contains supporting .md files that provide context
 * - Expanding references inline gives the model complete information without additional tool calls
 * - This follows progressive disclosure: skill summary first, full content on demand
 */
export async function loadSkillContent(skillPath: string): Promise<string> {
  const parts: string[] = []

  // Read main SKILL.md (strip frontmatter)
  const skillFile = path.join(skillPath, 'SKILL.md')
  const mainContent = await fs.readFile(skillFile, 'utf8')
  parts.push(stripFrontmatter(mainContent))

  // Read reference files if they exist
  const referencesDir = path.join(skillPath, 'references')
  try {
    const files = await fs.readdir(referencesDir)
    for (const file of files.sort()) {
      if (file.endsWith('.md')) {
        const refPath = path.join(referencesDir, file)
        const refContent = await fs.readFile(refPath, 'utf8')
        parts.push(`\n## Reference: ${file.replace('.md', '')}\n\n${refContent}`)
      }
    }
  } catch {
    // No references directory
  }

  return parts.join('\n\n')
}
