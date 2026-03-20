/**
 * Consolidated eval runner — handles baseline, MCP, and skills modes.
 *
 * Mode is inferred from optional fields:
 * - No mcpServerUrl + no skillsPath = baseline (no tools)
 * - mcpServerUrl = MCP mode
 * - skillsPath = skills mode
 */
import * as ai from 'ai'
import { initLogger, wrapAISDK } from 'braintrust'
import type { ExecArgs, RunnerResult, TokenUsage } from '@/src/interfaces'
import { buildSkillsSystemPrompt, createLoadSkillTool, discoverSkills } from '@/src/skills'
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

// Initialize Braintrust tracing in worker process (opt-in via env var).
// wrapAISDK auto-traces generateText calls including tool invocations.
if (process.env.BRAINTRUST_API_KEY) {
  initLogger({
    projectName: process.env.BRAINTRUST_PROJECT || 'clerk-evals',
    apiKey: process.env.BRAINTRUST_API_KEY,
  })
}

const { generateText } = wrapAISDK(ai)
const { stepCountIs } = ai

export default async function exec({
  provider,
  model,
  evalPath,
  debug = false,
  mcpServerUrl,
  skillsPath,
  maxToolRounds,
}: ExecArgs): Promise<RunnerResult> {
  const languageModel = resolveModel(provider, model)
  if (!languageModel) {
    return ERR(new Error(`Unsupported: ${provider}/${model}`))
  }

  let mcpClient: MCPClient | null = null

  try {
    // 1. Collect tools from all providers
    // biome-ignore lint: MCP client.tools() returns a compatible but structurally different type
    let tools: Record<string, any> = {}
    let systemPromptExtension = ''

    if (mcpServerUrl) {
      const mcp = await createMCPClient(mcpServerUrl)
      mcpClient = mcp.client
      tools = { ...tools, ...mcp.tools }
    }

    if (skillsPath) {
      const skills = await discoverSkills(skillsPath)
      if (skills.length === 0) {
        return ERR(new Error(`No skills found at: ${skillsPath}`))
      }
      tools = { ...tools, loadSkill: createLoadSkillTool(skills) }
      systemPromptExtension = buildSkillsSystemPrompt(skills)
    }

    // 2. Build system prompt
    const system = systemPromptExtension
      ? `${SYSTEM_PROMPT}\n\n${systemPromptExtension}`
      : SYSTEM_PROMPT

    // 3. Load eval prompt
    const prompt = await loadPrompt(evalPath)

    // 4. Generate text
    const hasTools = Object.keys(tools).length > 0
    const effectiveMaxRounds = maxToolRounds ?? (skillsPath ? 15 : 10)

    const startTime = performance.now()
    const response = await generateText({
      model: languageModel,
      prompt,
      system,
      ...(hasTools && {
        tools,
        stopWhen: stepCountIs(effectiveMaxRounds),
        maxTokens: 16384,
      }),
    })

    // 5. Extract response text and check for truncation
    const fullResponse = hasTools
      ? response.steps
          ?.map((s) => s.text)
          .filter(Boolean)
          .join('\n\n') || response.text
      : response.text

    const finishReason = hasTools ? response.steps?.at(-1)?.finishReason : response.finishReason

    if (finishReason === 'length') {
      return ERR(
        new Error(
          `Response truncated (finishReason: length, ${fullResponse.length} chars). Increase maxTokens or simplify the prompt.`,
        ),
      )
    }

    // 6. Grade
    const graders = await loadGraders(evalPath)
    const graderResults = await runGraders(graders, fullResponse)
    const score = computeScore(graderResults)

    // 7. Extract token usage and duration
    const durationMs = Math.round(performance.now() - startTime)
    const { inputTokens = 0, outputTokens = 0 } = response.totalUsage ?? response.usage ?? {}
    const hasUsage = (inputTokens ?? 0) > 0 || (outputTokens ?? 0) > 0
    const tokens: TokenUsage | undefined = hasUsage
      ? {
          promptTokens: inputTokens ?? 0,
          completionTokens: outputTokens ?? 0,
          totalTokens: (inputTokens ?? 0) + (outputTokens ?? 0),
        }
      : undefined

    // 8. Build result with optional debug payload
    return OK({
      score,
      tokens,
      durationMs,
      debug: debug
        ? hasTools
          ? { ...buildMCPDebugPayload(response, prompt, fullResponse, graderResults), finishReason }
          : { prompt, response: fullResponse, graders: graderResults, finishReason }
        : undefined,
    })
  } catch (error) {
    return ERR(error)
  } finally {
    await mcpClient?.close()
  }
}
