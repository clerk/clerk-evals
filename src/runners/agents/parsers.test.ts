import { describe, expect, test } from 'bun:test'
import { parseClaudeCommands, parseStreamJson } from './claude-code'
import { parseCodexCommands, parseCodexJsonl } from './codex'

describe('agent event parsers', () => {
  test('Claude grading uses only the final assistant message', () => {
    const output = [
      JSON.stringify({
        type: 'assistant',
        message: { content: [{ type: 'text', text: 'intermediate answer' }] },
      }),
      JSON.stringify({
        type: 'user',
        message: { content: [{ type: 'tool_result', content: 'secret tool output' }] },
      }),
      JSON.stringify({
        type: 'assistant',
        message: {
          content: [
            { type: 'text', text: 'final part one' },
            { type: 'text', text: 'final part two' },
          ],
        },
      }),
    ].join('\n')

    expect(parseStreamJson(output)).toBe('final part one\n\nfinal part two')
  })

  test('Codex grading uses only the final agent message', () => {
    const output = [
      JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: 'draft' } }),
      JSON.stringify({
        type: 'item.completed',
        item: { type: 'command_execution', aggregated_output: 'secret command output' },
      }),
      JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: 'final' } }),
    ].join('\n')

    expect(parseCodexJsonl(output)).toBe('final')
  })

  test('only completed Codex command events count as execution', () => {
    const output = [
      JSON.stringify({
        type: 'item.completed',
        item: { type: 'agent_message', text: 'Run npx -y clerk@latest init' },
      }),
      JSON.stringify({
        type: 'item.started',
        item: { type: 'command_execution', command: 'npx -y clerk@latest init' },
      }),
      JSON.stringify({
        type: 'item.completed',
        item: { type: 'command_execution', command: 'npx -y clerk@latest init', exit_code: 0 },
      }),
    ].join('\n')
    expect(parseCodexCommands(output)).toEqual(['npx -y clerk@latest init'])
  })

  test('only Claude Bash tool calls count as execution', () => {
    const output = [
      JSON.stringify({
        type: 'assistant',
        message: { content: [{ type: 'text', text: 'Run npx -y clerk@latest init' }] },
      }),
      JSON.stringify({
        type: 'assistant',
        message: {
          content: [
            {
              type: 'tool_use',
              id: 'tool-1',
              name: 'Bash',
              input: { command: 'npx -y clerk@latest init' },
            },
          ],
        },
      }),
      JSON.stringify({
        type: 'user',
        message: { content: [{ type: 'tool_result', tool_use_id: 'tool-1', content: 'done' }] },
      }),
    ].join('\n')
    expect(parseClaudeCommands(output)).toEqual(['npx -y clerk@latest init'])
  })

  test('an unreturned Claude tool request does not count as executed', () => {
    const output = JSON.stringify({
      type: 'assistant',
      message: {
        content: [
          {
            type: 'tool_use',
            id: 'pending',
            name: 'Bash',
            input: { command: 'npx -y clerk@latest init' },
          },
        ],
      },
    })
    expect(parseClaudeCommands(output)).toEqual([])
  })
})
