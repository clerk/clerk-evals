import { describe, expect, test } from 'bun:test'
import { ranClerkInit } from '@/src/evals/add-auth/graders/init-command'
import { runGraders } from './shared'

describe('agent command evidence', () => {
  test('passes structured execution evidence to the init grader', async () => {
    const graders = { runs_clerk_init: ranClerkInit }
    expect(await runGraders(graders, 'I ran npx -y clerk@latest init')).toEqual([
      ['runs_clerk_init', false],
    ])
    expect(
      await runGraders(graders, 'Done', { executedCommands: ['npx -y clerk@latest init'] }),
    ).toEqual([['runs_clerk_init', true]])
  })
})
