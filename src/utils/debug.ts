/**
 * Debug utilities for evaluation runners.
 */
import type { generateText } from 'ai'
import type { ToolCallInfo, ToolResultInfo } from '@/src/interfaces'
import { SYSTEM_PROMPT } from '@/src/runners/shared'

/** MCP tool call - AI SDK types say `args` but MCP returns `input` */
interface MCPToolCall {
  toolName: string
  input?: Record<string, unknown>
  args?: Record<string, unknown>
}

/** MCP tool result - AI SDK types say `result` but MCP returns `output` */
interface MCPToolResult {
  toolName: string
  output?: { content?: Array<{ type: string; text?: string }> }
  result?: unknown
}

const getToolInput = (tc: MCPToolCall) => tc.input ?? tc.args ?? {}
const getToolText = (tr: MCPToolResult) =>
  tr.output?.content?.[0]?.text ?? (typeof tr.result === 'string' ? tr.result : undefined)

/** Builds MCP debug payload with tool usage and transcript */
export function buildMCPDebugPayload(
  response: Awaited<ReturnType<typeof generateText>>,
  prompt: string,
  fullResponse: string,
  graderResults: [string, boolean][],
) {
  const toolCalls: ToolCallInfo[] = []
  const toolResults: ToolResultInfo[] = []
  const transcript: string[] = [
    '# MCP Evaluation Transcript\n',
    '## System Prompt\n```',
    SYSTEM_PROMPT.trim(),
    '```\n',
    '## User Prompt\n```markdown',
    prompt.trim(),
    '```\n---\n## Conversation\n',
  ]

  for (const [i, step] of (response.steps || []).entries()) {
    transcript.push(`### Step ${i + 1} (${step.finishReason})\n`)

    if (step.text) {
      const text = step.text.length > 500 ? `${step.text.slice(0, 500)}...` : step.text
      transcript.push(`**Assistant:**\n${text}\n`)
    }

    for (const tc of (step.toolCalls || []) as MCPToolCall[]) {
      const input = getToolInput(tc)
      toolCalls.push({ toolName: tc.toolName, args: input })
      transcript.push(
        `**Tool:** \`${tc.toolName}\`\n\`\`\`json\n${JSON.stringify(input, null, 2)}\n\`\`\`\n`,
      )
    }

    for (const tr of (step.toolResults || []) as MCPToolResult[]) {
      const text = getToolText(tr) || '(no result)'
      toolResults.push({ toolName: tr.toolName, result: text })
      const display = text.length > 1000 ? `${text.slice(0, 1000)}...` : text
      transcript.push(`**Result:** \`${tr.toolName}\`\n\`\`\`\n${display}\n\`\`\`\n`)
    }
    transcript.push('---\n')
  }

  // Grader summary
  const passed = graderResults.filter(([, p]) => p).length
  transcript.push(
    `## Grader Results\n**Score: ${((passed / graderResults.length) * 100).toFixed(1)}%** (${passed}/${graderResults.length})\n`,
    '| Grader | Result |\n|--------|--------|\n',
    ...graderResults.map(([name, p]) => `| ${name} | ${p ? 'PASS' : 'FAIL'} |`),
  )

  return {
    prompt,
    response: fullResponse,
    graders: graderResults,
    toolCalls,
    toolResults,
    transcript: transcript.join('\n'),
  }
}
