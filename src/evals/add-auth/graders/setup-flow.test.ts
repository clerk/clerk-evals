import { describe, expect, test } from 'bun:test'
import { ranClerkInit } from './init-command'

describe('add-auth init grader', () => {
  test('does not accept a command only mentioned in prose or source files', async () => {
    expect(await ranClerkInit('I ran npx -y clerk@latest init')).toBe(false)
    expect(await ranClerkInit('npx -y clerk@latest init', { executedCommands: [] })).toBe(false)
  })

  test('accepts an observed command execution', async () => {
    expect(
      await ranClerkInit('Done', { executedCommands: ['cd app && npx -y clerk@latest init'] }),
    ).toBe(true)
  })
})
