/**
 * System prompt builder for Agent Skills.
 *
 * Generates a system prompt extension listing available skills
 * so the model knows what specialized knowledge it can load on demand.
 */
import type { SkillMetadata } from '@/src/interfaces'

/**
 * Build system prompt extension for available skills.
 * Includes only names and descriptions (progressive disclosure).
 */
export function buildSkillsSystemPrompt(skills: SkillMetadata[]): string {
  if (skills.length === 0) return ''

  const skillsList = skills.map((s) => `- ${s.name}: ${s.description}`).join('\n')

  return `
## Skills

You have access to specialized Clerk documentation via the \`loadSkill\` tool.
When the task requires framework-specific guidance, authentication patterns,
or Clerk API knowledge, load the relevant skill first.

Available skills:
${skillsList}
`
}
