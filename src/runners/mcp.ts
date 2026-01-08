/**
 * MCP Runner - executes evaluations with MCP tool support.
 *
 * IMPORTANT: Uses @ai-sdk/mcp@0.0.12 due to Standard Schema compatibility.
 * Version 1.0+ requires Standard Schema which MCP servers don't provide.
 * See: https://github.com/modelcontextprotocol/typescript-sdk/issues/283
 */
import { experimental_createMCPClient } from '@ai-sdk/mcp'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { generateText, stepCountIs } from 'ai'
import type { MCPRunnerArgs, RunnerResult } from '@/src/interfaces'
import { buildMCPDebugPayload } from '@/src/utils/debug'
import { ERR, OK } from '@/src/utils/result'
import {
  computeScore,
  loadGraders,
  loadPrompt,
  resolveModel,
  runGraders,
  SYSTEM_PROMPT,
} from './shared'

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
  const languageModel = resolveModel(provider, model)
  if (!languageModel) {
    return ERR(new Error(`Unsupported: ${provider}/${model}`))
  }

  let mcpClient: Awaited<ReturnType<typeof experimental_createMCPClient>> | null = null

  try {
    // Connect to MCP server
    const transport = new StreamableHTTPClientTransport(new URL(mcpServerUrl))
    mcpClient = await experimental_createMCPClient({ transport })
    const mcpTools = await mcpClient.tools()

    // Load prompt and generate with tool support
    const prompt = await loadPrompt(evalPath)
    const response = await generateText({
      model: languageModel,
      prompt,
      system: SYSTEM_PROMPT,
      tools: mcpTools,
      stopWhen: stepCountIs(maxToolRounds),
      maxTokens: 16384,
    })

    // Collect text from all steps
    const fullResponse =
      response.steps
        ?.map((s) => s.text)
        .filter(Boolean)
        .join('\n\n') || response.text

    // Run graders
    const graders = await loadGraders(evalPath)
    const graderResults = await runGraders(graders, fullResponse)
    const score = computeScore(graderResults)

    return OK({
      score,
      debug: debug
        ? buildMCPDebugPayload(response, prompt, fullResponse, graderResults)
        : undefined,
    })
  } catch (error) {
    return ERR(error)
  } finally {
    await mcpClient?.close()
  }
}
