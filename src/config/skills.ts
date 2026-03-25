/**
 * Skills configuration for agent evaluations.
 *
 * Maps eval paths to relevant Clerk skills and injects them via CLAUDE.md.
 * Claude Code auto-loads CLAUDE.md in the working directory.
 */
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import matter from 'gray-matter'

/**
 * Maps eval paths to relevant Clerk skills.
 * More accurate than category-based mapping since each eval has specific needs.
 * Skills must exist in the skills repo at skills/<name>/SKILL.md
 */
export const EVAL_SKILL_MAPPING: Record<string, string[]> = {
  // Quickstarts
  'evals/quickstarts/nextjs': ['setup', 'nextjs-patterns'],
  'evals/quickstarts/nextjs-app-router': ['setup', 'nextjs-patterns'],
  'evals/quickstarts/react-vite': ['setup'],

  // Auth - NOT custom-flows! These need route protection patterns
  'evals/auth/protect': ['nextjs-patterns', 'orgs'],
  'evals/auth/routes': ['nextjs-patterns'],

  // User Management
  'evals/user-management/profile-page': ['nextjs-patterns'],

  // UI Components - mixed needs
  'evals/ui-components/sign-in-customization': ['custom-ui'],
  'evals/ui-components/user-button-menu': ['custom-ui'],
  'evals/ui-components/user-profile-embed': ['custom-ui'],
  'evals/ui-components/organization-switcher': ['orgs'],

  // Organizations
  'evals/organizations/url-sync': ['orgs', 'nextjs-patterns'],
  'evals/organizations/membership-webhook': ['webhooks'],

  // Webhooks
  'evals/webhooks/user-created': ['webhooks'],
  'evals/webhooks/user-sync': ['webhooks'],
  'evals/webhooks/notifications': ['webhooks'],

  // Billing - checkout vs webhooks
  'evals/billing/checkout-new': ['custom-ui'],
  'evals/billing/checkout-existing': ['custom-ui'],
  'evals/billing/events-webhook': ['webhooks'],
  'evals/billing/subscriptions-webhook': ['webhooks'],

  // iOS
  'evals/ios/prebuilt-setup': ['swift'],
  'evals/ios/custom-setup': ['swift'],
  'evals/ios/routing': ['swift', 'setup'],

  // Android
  'evals/android/prebuilt-setup': ['android'],
  'evals/android/custom-setup': ['android'],
  // routing intentionally excluded — tests Expo detection, Android skill discourages Expo

  // Add Auth (framework-agnostic, skills based on variant)
  'evals/add-auth': ['setup', 'nextjs-patterns'],
}

/**
 * Get skill names for a given eval path.
 */
export function getSkillsForEval(evalPath: string): string[] {
  // Normalize path (remove leading src/ if present)
  const normalized = evalPath.replace(/^src\//, '')
  return EVAL_SKILL_MAPPING[normalized] || []
}

/**
 * Parse SKILL.md frontmatter to extract name and description.
 */
function parseFrontmatter(content: string): { name: string; description: string } | null {
  const { data } = matter(content)
  if (!data.name || !data.description) return null
  return {
    name: data.name,
    description: data.description,
  }
}

/**
 * Copy skill directories into the agent's working directory for progressive discovery.
 *
 * Following the agentskills.io specification:
 * - Tier 1 (Catalog): CLAUDE.md lists skill names + descriptions + paths (~50-100 tokens/skill)
 * - Tier 2 (Activation): Agent reads full SKILL.md on-demand via native file-read tools
 * - Tier 3 (Resources): Agent reads scripts/, references/ as needed
 *
 * This replaces the old approach of dumping 21KB of full skill content into CLAUDE.md upfront.
 *
 * @param evalPath - The evaluation path to get skills for (e.g., 'evals/auth/protect')
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
  const catalogEntries: string[] = []

  // Create .skills/ directory in workDir to hold skill copies
  const skillsDir = path.join(workDir, '.skills')
  await fs.mkdir(skillsDir, { recursive: true })

  for (const name of skillNames) {
    const skillDir = path.join(skillsSourcePath, name)
    const skillMdPath = path.join(skillDir, 'SKILL.md')

    try {
      const content = await fs.readFile(skillMdPath, 'utf8')
      const meta = parseFrontmatter(content)
      if (!meta) continue

      // Copy only essential skill files (SKILL.md + scripts/ + references/ + assets/)
      const destDir = path.join(skillsDir, name)
      await fs.mkdir(destDir, { recursive: true })
      await fs.copyFile(skillMdPath, path.join(destDir, 'SKILL.md'))
      for (const subdir of ['scripts', 'references', 'assets']) {
        const src = path.join(skillDir, subdir)
        const dest = path.join(destDir, subdir)
        try {
          await fs.cp(src, dest, { recursive: true })
        } catch {
          // Subdir doesn't exist, skip
        }
      }

      catalogEntries.push(`- ${meta.name}: ${meta.description} (path: .skills/${name}/SKILL.md)`)
      loadedSkills.push(name)
    } catch {
      // Skill doesn't exist or can't be read
    }
  }

  if (loadedSkills.length > 0) {
    const catalog = `# Skills

The following Clerk skills are available. When the task matches a skill's description,
read the SKILL.md file at the listed path to get specialized instructions.

${catalogEntries.join('\n')}
`
    const claudeMdPath = path.join(workDir, 'CLAUDE.md')
    await fs.writeFile(claudeMdPath, catalog)
  }

  return loadedSkills
}
