/**
 * Consolidated eval runner — handles baseline, MCP, skills, and skills+MCP modes.
 *
 * Mode is inferred from optional fields:
 * - No mcpServerUrl + no skillsPath = baseline (no tools)
 * - mcpServerUrl only = MCP mode
 * - skillsPath only = skills mode
 * - Both = skills + MCP mode
 */
import { generateText, stepCountIs } from 'ai'
import type { ExecArgs, RunnerResult } from '@/src/interfaces'
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

    // 5. Extract response text (multi-step join when tools are used)
    const fullResponse = hasTools
      ? response.steps
          ?.map((s) => s.text)
          .filter(Boolean)
          .join('\n\n') || response.text
      : response.text

    // 6. Grade
    const graders = await loadGraders(evalPath)
    const graderResults = await runGraders(graders, fullResponse)
    const score = computeScore(graderResults)

    // 7. Build result with optional debug payload
    return OK({
      score,
      debug: debug
        ? hasTools
          ? buildMCPDebugPayload(response, prompt, fullResponse, graderResults)
          : { prompt, response: fullResponse, graders: graderResults }
        : undefined,
    })
  } catch (error) {
    return ERR(error)
  } finally {
    await mcpClient?.close()
  }
}
