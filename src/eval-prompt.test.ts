import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, test } from 'bun:test'
import {
  loadCanonicalSetupPrompt,
  loadEvaluationPrompt,
  stripSkillFrontmatter,
} from './eval-prompt'

const tempDirs: string[] = []
afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('canonical add-auth prompt', () => {
  test('removes only frontmatter and keeps the skill body', () => {
    expect(stripSkillFrontmatter('---\nname: clerk-setup\n---\n# Set up Clerk\n')).toBe(
      '# Set up Clerk\n',
    )
    expect(() => stripSkillFrontmatter('# Not a skill')).toThrow('frontmatter')
  })

  test('fetches the immutable flat path and rejects a failed response', async () => {
    const sha = 'a'.repeat(40)
    const requested: string[] = []
    const prompt = await loadCanonicalSetupPrompt({
      revision: sha,
      fetchImpl: async (url) => {
        requested.push(String(url))
        return new Response('---\nname: clerk-setup\n---\nFollow the quickstart')
      },
    })
    expect(prompt).toBe('Follow the quickstart')
    expect(requested).toEqual([
      `https://raw.githubusercontent.com/clerk/skills/${sha}/skills/clerk-setup/SKILL.md`,
    ])
    expect(
      loadCanonicalSetupPrompt({
        revision: sha,
        fetchImpl: async () => new Response('', { status: 404 }),
      }),
    ).rejects.toThrow('404')
  })

  test('rejects an unpinned revision', () => {
    expect(
      loadCanonicalSetupPrompt({ revision: 'main', fetchImpl: async () => new Response('') }),
    ).rejects.toThrow('full clerk/skills commit SHA')
  })

  test('keeps ordinary eval prompts local', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'eval-prompt-'))
    tempDirs.push(dir)
    await writeFile(path.join(dir, 'PROMPT.md'), 'Local prompt')
    expect(await loadEvaluationPrompt(dir)).toBe('Local prompt')
  })
})
