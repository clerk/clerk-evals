/**
 * MCP Runner - executes evaluations with MCP tool support.
 */
import { generateText, stepCountIs } from 'ai'
import type { MCPRunnerArgs, RunnerResult } from '@/src/interfaces'
import { buildMCPDebugPayload } from '@/src/utils/debug'
import { createMCPClient, type MCPClient } from '@/src/utils/mcp-client'
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

  let mcpClient: MCPClient | null = null

  try {
    // Connect to MCP server
    const mcp = await createMCPClient(mcpServerUrl)
    mcpClient = mcp.client
    const mcpTools = mcp.tools

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
