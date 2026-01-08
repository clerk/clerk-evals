/**
 * MCP Runner - executes evaluations with MCP tool support.
 *
 * IMPORTANT: Uses @ai-sdk/mcp@0.0.12 due to Standard Schema compatibility.
 * Version 1.0+ requires Standard Schema which MCP servers don't provide.
 * See: https://github.com/modelcontextprotocol/typescript-sdk/issues/283
 */
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { experimental_createMCPClient } from '@ai-sdk/mcp'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { generateText, stepCountIs } from 'ai'
import type { Graders } from '@/src/graders'
import type { MCPRunnerArgs, RunnerResult, ToolCallInfo, ToolResultInfo } from '@/src/interfaces'
import { getModel } from '@/src/providers'
import { ERR, OK } from '@/src/utils/result'

/**
 * MCP tool call structure from AI SDK 0.0.12.
 * Note: AI SDK types say `args` but MCP transport returns `input`.
 */
interface MCPToolCall {
  type: 'tool-call'
  toolCallId: string
  toolName: string
  input?: Record<string, unknown>
  args?: Record<string, unknown>
}

/**
 * MCP tool result structure from AI SDK 0.0.12.
 * Note: AI SDK types say `result` but MCP transport returns `output`.
 */
interface MCPToolResult {
  type: 'tool-result'
  toolCallId: string
  toolName: string
  output?: { content?: Array<{ type: string; text?: string }> }
  result?: unknown
}

/**
 * Extracts text content from MCP tool result.
 * Handles both `output.content[0].text` (MCP format) and `result` (AI SDK typed).
 */
function extractToolResultText(tr: MCPToolResult): string | undefined {
  return tr.output?.content?.[0]?.text ?? (typeof tr.result === 'string' ? tr.result : undefined)
}

/**
 * Gets input from tool call (handles MCP's `input` vs AI SDK's `args`).
 */
function getToolCallInput(tc: MCPToolCall): Record<string, unknown> | undefined {
  return tc.input ?? tc.args
}

/**
 * System prompt for MCP evaluations.
 * Identical to baseline runner - tools are discovered dynamically via MCP.
 */
const systemPrompt = `
YOU MUST output all files as fenced code blocks, like so

\`\`\`lang file="path/to/file.ts"

\`\`\`
`

/**
 * MCP Runner - executes evaluations with MCP tool support
 */
export default async function exec({
  provider,
  model,
  evalPath,
  mcpServerUrl,
  maxToolRounds = 10,
  debug = false,
}: MCPRunnerArgs): Promise<RunnerResult> {
  const languageModel = getModel(provider, model)
  if (!languageModel) {
    return ERR(new Error(`Unsupported: ${provider}/${model}`))
  }

  let mcpClient: Awaited<ReturnType<typeof experimental_createMCPClient>> | null = null

  try {
    // Connect to MCP server using StreamableHTTPClientTransport (0.0.12 API)
    console.log(`[MCP] Connecting to ${mcpServerUrl}...`)
    const transport = new StreamableHTTPClientTransport(new URL(mcpServerUrl))
    mcpClient = await experimental_createMCPClient({ transport })
    console.log(`[MCP] Connected successfully`)

    // Get MCP tools
    console.log(`[MCP] Fetching available tools...`)
    const mcpTools = await mcpClient.tools()
    const toolNames = Object.keys(mcpTools)
    console.log(`[MCP] Got ${toolNames.length} tools: ${toolNames.join(', ')}`)

    // Load the prompt
    const prompt = await fs.readFile(path.join(evalPath, 'PROMPT.md'), 'utf8')

    // Generate with tool support and agentic loop
    console.log(`[MCP] Starting generation with model ${model}...`)
    const response = await generateText({
      model: languageModel,
      prompt,
      system: systemPrompt,
      tools: mcpTools,
      stopWhen: stepCountIs(maxToolRounds),
      maxTokens: 16384,
      onStepFinish: (step) => {
        const stepToolCalls = (step.toolCalls || []) as MCPToolCall[]
        const stepToolResults = (step.toolResults || []) as MCPToolResult[]

        if (stepToolCalls.length > 0) {
          console.log(`\n[MCP] === TOOL CALLS ===`)
          for (const tc of stepToolCalls) {
            const input = getToolCallInput(tc)
            console.log(`[MCP] Tool: ${tc.toolName}`)
            console.log(`[MCP] Input: ${input ? JSON.stringify(input, null, 2) : '(no input)'}`)
          }
        }

        if (stepToolResults.length > 0) {
          console.log(`\n[MCP] === TOOL RESULTS ===`)
          for (const tr of stepToolResults) {
            const text = extractToolResultText(tr)
            console.log(`[MCP] Tool: ${tr.toolName}`)
            console.log(
              `[MCP] Result: ${text ? (text.length > 300 ? `${text.slice(0, 300)}...` : text) : '(no result)'}`,
            )
          }
        }

        if (step.text && step.text.length > 0) {
          console.log(`\n[MCP] === ASSISTANT TEXT ===`)
          console.log(
            `[MCP] ${step.text.length > 300 ? `${step.text.slice(0, 300)}...` : step.text}`,
          )
        }

        console.log(`[MCP] Step finished: ${step.finishReason}`)
      },
    })

    // Summary logging
    console.log(`\n[MCP] === GENERATION COMPLETE ===`)
    console.log(`[MCP] Total steps: ${response.steps?.length || 0}`)
    console.log(`[MCP] Final text length: ${response.text?.length || 0}`)
    console.log(`[MCP] Finish reason: ${response.finishReason}`)

    // Extract tool usage info and combine all text from steps
    const toolCalls: ToolCallInfo[] = []
    const toolResults: ToolResultInfo[] = []
    const allTextParts: string[] = []

    // Build markdown chat transcript for debugging
    const chatTranscript: string[] = []
    chatTranscript.push('# MCP Evaluation Transcript\n')
    chatTranscript.push('## System Prompt\n')
    chatTranscript.push('```')
    chatTranscript.push(systemPrompt.trim())
    chatTranscript.push('```\n')
    chatTranscript.push('## User Prompt\n')
    chatTranscript.push('```markdown')
    chatTranscript.push(prompt.trim())
    chatTranscript.push('```\n')
    chatTranscript.push('---\n')
    chatTranscript.push('## Conversation\n')

    if (response.steps) {
      for (let stepIdx = 0; stepIdx < response.steps.length; stepIdx++) {
        const step = response.steps[stepIdx]
        chatTranscript.push(`### Step ${stepIdx + 1} (${step.finishReason})\n`)

        // Assistant text
        if (step.text) {
          allTextParts.push(step.text)
          chatTranscript.push('**Assistant:**\n')
          const displayText =
            step.text.length > 500
              ? `${step.text.slice(0, 500)}...\n\n_(truncated, ${step.text.length} chars total)_`
              : step.text
          chatTranscript.push(displayText)
          chatTranscript.push('\n')
        }

        // Tool calls
        if (step.toolCalls && step.toolCalls.length > 0) {
          const typedToolCalls = step.toolCalls as MCPToolCall[]
          chatTranscript.push('**Tool Calls:**\n')
          for (const tc of typedToolCalls) {
            const input = getToolCallInput(tc)
            toolCalls.push({
              toolName: tc.toolName,
              args: input || {},
            })
            chatTranscript.push(`\`${tc.toolName}\``)
            chatTranscript.push('```json')
            chatTranscript.push(JSON.stringify(input || {}, null, 2))
            chatTranscript.push('```\n')
          }
        }

        // Tool results
        if (step.toolResults && step.toolResults.length > 0) {
          const typedToolResults = step.toolResults as MCPToolResult[]
          chatTranscript.push('**Tool Results:**\n')
          for (const tr of typedToolResults) {
            const textContent = extractToolResultText(tr)

            toolResults.push({
              toolName: tr.toolName,
              result: textContent || '(no result)',
            })

            chatTranscript.push(`\`${tr.toolName}\` returned:`)
            if (textContent) {
              const displayResult =
                textContent.length > 1000
                  ? `${textContent.slice(0, 1000)}...\n\n_(truncated, ${textContent.length} chars total)_`
                  : textContent
              chatTranscript.push('```')
              chatTranscript.push(displayResult)
              chatTranscript.push('```\n')
            } else {
              chatTranscript.push('```')
              chatTranscript.push('(no result)')
              chatTranscript.push('```\n')
            }
          }
        }

        chatTranscript.push('---\n')
      }
    }

    // Use combined text from all steps, or fall back to response.text
    const fullResponse = allTextParts.length > 0 ? allTextParts.join('\n\n') : response.text

    // Load and run graders
    const graderModule = (await import(path.join(evalPath, 'graders.ts'))) as {
      graders: Graders
    }

    const graderResults: [string, boolean][] = []
    for (const [key, grader] of Object.entries(graderModule.graders)) {
      const passed = await grader(fullResponse)
      graderResults.push([key, passed])
    }

    const score =
      graderResults.filter(([_, isCorrect]) => isCorrect).length / (graderResults.length || 1)

    // Log grader results
    console.log(`\n[MCP] === GRADER RESULTS ===`)
    console.log(
      `[MCP] Score: ${(score * 100).toFixed(1)}% (${graderResults.filter(([_, p]) => p).length}/${graderResults.length})`,
    )
    for (const [name, passed] of graderResults) {
      console.log(`[MCP] ${passed ? 'PASS' : 'FAIL'}: ${name}`)
    }

    // Add grader results to transcript
    chatTranscript.push('## Grader Results\n')
    chatTranscript.push(
      `**Score: ${(score * 100).toFixed(1)}%** (${graderResults.filter(([_, p]) => p).length}/${graderResults.length})\n`,
    )
    chatTranscript.push('| Grader | Result |')
    chatTranscript.push('|--------|--------|')
    for (const [name, passed] of graderResults) {
      chatTranscript.push(`| ${name} | ${passed ? 'PASS' : 'FAIL'} |`)
    }
    chatTranscript.push('')

    return OK({
      score,
      debug: debug
        ? {
            prompt,
            response: fullResponse,
            graders: graderResults,
            toolCalls,
            toolResults,
            transcript: chatTranscript.join('\n'),
          }
        : undefined,
    })
  } catch (error) {
    console.error(`[MCP] Error:`, error)
    return ERR(error)
  } finally {
    // Always close MCP client
    if (mcpClient) {
      await mcpClient.close()
    }
  }
}
