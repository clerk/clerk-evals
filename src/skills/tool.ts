/**
 * loadSkill tool for AI SDK generateText.
 *
 * Allows models to load specialized Clerk documentation on demand,
 * following the Agent Skills progressive disclosure pattern.
 *
 * Uses jsonSchema() instead of Zod to avoid Zod v4 serialization issues
 * with the Anthropic API (missing type field in input_schema).
 *
 * @see https://ai-sdk.dev/cookbook/guides/agent-skills
 */
import { jsonSchema, tool } from 'ai'
import type { SkillMetadata } from '@/src/interfaces'
import { loadSkillContent } from './discovery'

/**
 * Create the loadSkill tool with discovered skills captured in closure.
 */
export function createLoadSkillTool(skills: SkillMetadata[]) {
  return tool({
    description:
      'Load a Clerk skill to get specialized instructions for building with Clerk authentication',
    inputSchema: jsonSchema<{ name: string }>({
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'The skill name to load',
        },
      },
      required: ['name'],
      additionalProperties: false,
    }),
    execute: async ({ name }) => {
      const skill = skills.find((s) => s.name.toLowerCase() === name.toLowerCase())

      if (!skill) {
        return {
          error: `Skill "${name}" not found. Available skills: ${skills.map((s) => s.name).join(', ')}`,
        }
      }

      const content = await loadSkillContent(skill.path)
      return {
        skillName: skill.name,
        content,
        skillDirectory: skill.path,
      }
    },
  })
}
