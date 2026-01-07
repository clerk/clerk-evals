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
    // Connect to MCP server
    if (debug) console.log(`[MCP Runner] Connecting to ${mcpServerUrl}...`)
    const transport = new StreamableHTTPClientTransport(new URL(mcpServerUrl))
    mcpClient = await experimental_createMCPClient({ transport })
    if (debug) console.log(`[MCP Runner] Connected, fetching tools...`)

    // Get MCP tools
    const mcpTools = await mcpClient.tools()
    if (debug)
      console.log(`[MCP Runner] Got ${Object.keys(mcpTools).length} tools, starting generation...`)

    // Load the prompt
    const prompt = await fs.readFile(path.join(evalPath, 'PROMPT.md'), 'utf8')

    // Generate with tool support and agentic loop
    // Use stopWhen instead of deprecated maxSteps (AI SDK 5+)
    const response = await generateText({
      model: languageModel,
      prompt,
      system: systemPrompt,
      tools: mcpTools,
      stopWhen: stepCountIs(maxToolRounds),
      maxTokens: 16384, // Increase to allow for complete code generation
    })

    // Debug: log step information
    if (debug) {
      console.log(`[MCP Runner] Total steps: ${response.steps?.length || 0}`)
      console.log(`[MCP Runner] Final text length: ${response.text?.length || 0}`)
      console.log(`[MCP Runner] Finish reason: ${response.finishReason}`)
      if (response.steps) {
        for (let i = 0; i < response.steps.length; i++) {
          const step = response.steps[i]
          const toolNames = step.toolCalls?.map((tc) => tc.toolName).join(', ') || 'none'
          console.log(
            `[MCP Runner] Step ${i}: text=${step.text?.length || 0} chars, tools=[${toolNames}], finishReason=${step.finishReason}`,
          )
        }
      }
    }

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
          chatTranscript.push('**🤖 Assistant:**\n')
          // Truncate long text for readability
          const displayText =
            step.text.length > 500
              ? `${step.text.slice(0, 500)}...\n\n_(truncated, ${step.text.length} chars total)_`
              : step.text
          chatTranscript.push(displayText)
          chatTranscript.push('\n')
        }

        // Tool calls
        if (step.toolCalls && step.toolCalls.length > 0) {
          chatTranscript.push('**🔧 Tool Calls:**\n')
          for (const tc of step.toolCalls) {
            toolCalls.push({
              toolName: tc.toolName,
              args: tc.args || {},
            })
            chatTranscript.push(`\`${tc.toolName}\``)
            chatTranscript.push('```json')
            chatTranscript.push(JSON.stringify(tc.args || {}, null, 2))
            chatTranscript.push('```\n')
          }
        }

        // Tool results
        if (step.toolResults && step.toolResults.length > 0) {
          chatTranscript.push('**📥 Tool Results:**\n')
          for (const tr of step.toolResults) {
            // AI SDK may have result in different locations depending on version
            // Try multiple paths to find the actual content
            const rawResult = tr.result as
              | {
                  output?: { content?: Array<{ text?: string }> }
                  content?: Array<{ text?: string }>
                }
              | undefined

            // Try different paths for MCP content
            let textContent =
              rawResult?.output?.content?.[0]?.text ||
              rawResult?.content?.[0]?.text ||
              (typeof rawResult === 'string' ? rawResult : undefined)

            // If still no content, check if tr has other properties with the result
            const trAny = tr as Record<string, unknown>
            if (!textContent && trAny.output) {
              const output = trAny.output as { content?: Array<{ text?: string }> }
              textContent = output?.content?.[0]?.text
            }

            toolResults.push({
              toolName: tr.toolName,
              result: textContent || rawResult || trAny.output || '(no result)',
            })

            chatTranscript.push(`\`${tr.toolName}\` returned:`)
            if (textContent) {
              // Truncate long results
              const displayResult =
                textContent.length > 1000
                  ? `${textContent.slice(0, 1000)}...\n\n_(truncated, ${textContent.length} chars total)_`
                  : textContent
              chatTranscript.push('```')
              chatTranscript.push(displayResult)
              chatTranscript.push('```\n')
            } else if (rawResult !== undefined && rawResult !== null) {
              chatTranscript.push('```json')
              const resultStr = JSON.stringify(rawResult, null, 2) || '(empty)'
              chatTranscript.push(resultStr.slice(0, 500))
              chatTranscript.push('```\n')
            } else if (trAny.output) {
              chatTranscript.push('```json')
              const resultStr = JSON.stringify(trAny.output, null, 2) || '(empty)'
              chatTranscript.push(resultStr.slice(0, 500))
              chatTranscript.push('```\n')
            } else {
              // Log the full tr object to debug
              chatTranscript.push('```json')
              chatTranscript.push(`// Debug: tr keys = ${Object.keys(tr).join(', ')}`)
              chatTranscript.push(JSON.stringify(tr, null, 2).slice(0, 300))
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

    // Add grader results to transcript
    chatTranscript.push('## Grader Results\n')
    chatTranscript.push(
      `**Score: ${(score * 100).toFixed(1)}%** (${graderResults.filter(([_, p]) => p).length}/${graderResults.length})\n`,
    )
    chatTranscript.push('| Grader | Result |')
    chatTranscript.push('|--------|--------|')
    for (const [name, passed] of graderResults) {
      chatTranscript.push(`| ${name} | ${passed ? '✅' : '❌'} |`)
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
    if (debug) {
      console.error(`[MCP Runner] Error:`, error)
    }
    return ERR(error)
  } finally {
    // Always close MCP client
    if (mcpClient) {
      await mcpClient.close()
    }
  }
}
