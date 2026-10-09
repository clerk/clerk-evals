import { describe, expect, test } from 'bun:test'
import { ranClerkInit } from './init-command'

describe('add-auth init grader', () => {
  test('agent runs do not accept a command only mentioned in prose or source files', async () => {
    expect(await ranClerkInit('I ran npx -y clerk@latest init', { executedCommands: [] })).toBe(
      false,
    )
  })

  test('agent runs accept an observed command execution', async () => {
    expect(
      await ranClerkInit('Done', { executedCommands: ['cd app && npx -y clerk@latest init'] }),
    ).toBe(true)
  })

  test('text runs, which have no command channel, grade the response', async () => {
    expect(await ranClerkInit('Run `npx -y clerk@latest init` from the project root')).toBe(true)
    expect(await ranClerkInit('Install @clerk/nextjs and add the provider')).toBe(false)
  })
})
