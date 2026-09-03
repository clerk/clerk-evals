import { describe, expect, test } from 'bun:test'
import { parseStreamJson } from './claude-code'
import { parseCodexJsonl } from './codex'

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
})
