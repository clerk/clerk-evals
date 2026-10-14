import { describe, expect, test } from 'bun:test'
import { cellKey, loadPromptPair, planCells, summarizeCells } from './experiment'

describe('Next.js prompt A/B plan', () => {
  test('creates 60 balanced cells for five trials per agent and fixture', () => {
    const cells = planCells(5)
    expect(cells).toHaveLength(60)
    expect(new Set(cells.map(cellKey)).size).toBe(60)
    expect(cells.filter((cell) => cell.arm === 'dedicated')).toHaveLength(30)
    expect(cells.filter((cell) => cell.arm === 'shared')).toHaveLength(30)
    expect(cells.filter((cell) => cell.fixture === 'next15')).toHaveLength(20)
    expect(cells.filter((cell) => cell.fixture === 'next16')).toHaveLength(20)
    expect(cells.filter((cell) => cell.fixture === 'empty')).toHaveLength(20)
  })

  test('rejects invalid trial counts', () => {
    expect(() => planCells(0)).toThrow()
    expect(() => planCells(1.5)).toThrow()
  })

  test('reads both prompts at exactly one commit and records hashes', () => {
    const paths: string[] = []
    const sha = 'a'.repeat(40)
    const prompts = loadPromptPair(sha, '/docs', (_repo, revision, filePath) => {
      expect(revision).toBe(sha)
      paths.push(filePath)
      return '# Prompt'
    })
    expect(paths).toEqual([
      'clerk-docs/prompts/nextjs-quickstart.md',
      'clerk-docs/prompts/cli-setup.md',
    ])
    expect(prompts.dedicated.content).toBe('# Prompt')
    expect(prompts.dedicated.sha256).toMatch(/^[0-9a-f]{64}$/)
  })

  test('does not treat infrastructure errors as prompt failures', () => {
    const summary = summarizeCells([
      {
        agent: 'codex',
        arm: 'dedicated',
        fixture: 'next15',
        trial: 1,
        status: 'completed',
        score: 1,
        graders: { build: true },
        durationMs: 10,
      },
      {
        agent: 'codex',
        arm: 'shared',
        fixture: 'next15',
        trial: 1,
        status: 'error',
        error: 'gateway unavailable',
        durationMs: 10,
      },
    ])
    expect(summary.completed).toBe(1)
    expect(summary.errors).toBe(1)
    expect(summary.passRate).toBe(1)
  })
})
