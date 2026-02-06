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
import type { SkillMetadata } from '@/src/interfaces'

/**
 * Parse YAML frontmatter from SKILL.md content.
 * Extracts name and description fields using simple line parsing.
 */
export function parseFrontmatter(content: string): { name: string; description: string } {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!match?.[1]) throw new Error('No frontmatter found')

  const data: Record<string, string> = {}
  for (const line of match[1].split('\n')) {
    const colonIdx = line.indexOf(':')
    if (colonIdx === -1) continue
    const key = line.slice(0, colonIdx).trim()
    const value = line
      .slice(colonIdx + 1)
      .trim()
      .replace(/^["']|["']$/g, '')
    if (key && value) data[key] = value
  }

  return {
    name: data.name || '',
    description: data.description || '',
  }
}

/**
 * Strip YAML frontmatter from content, returning only the body.
 */
export function stripFrontmatter(content: string): string {
  const match = content.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/)
  return match ? content.slice(match[0].length).trim() : content.trim()
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
