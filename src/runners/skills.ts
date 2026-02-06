/**
 * Skills Runner - executes evaluations with Agent Skills support.
 *
 * Progressive disclosure: models discover skill summaries in the system prompt
 * and load full content on demand via the loadSkill tool.
 *
 * Supports optional MCP integration when mcpServerUrl is provided.
 *
 * @see https://ai-sdk.dev/cookbook/guides/agent-skills
 */
import { generateText, stepCountIs } from 'ai'
import type { RunnerResult, SkillsRunnerArgs } from '@/src/interfaces'
import { buildSkillsSystemPrompt, createLoadSkillTool, discoverSkills } from '@/src/skills'
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
 * Optional MCP client setup - only imported when mcpServerUrl is provided.
 */
async function connectMCP(mcpServerUrl: string) {
  const { experimental_createMCPClient } = await import('@ai-sdk/mcp')
  const { StreamableHTTPClientTransport } = await import(
    '@modelcontextprotocol/sdk/client/streamableHttp.js'
  )
  const transport = new StreamableHTTPClientTransport(new URL(mcpServerUrl))
  const client = await experimental_createMCPClient({ transport })
  const tools = await client.tools()
  return { client, tools }
}

/**
 * Skills runner - supports skills-only and skills+MCP modes.
 */
export default async function exec({
  provider,
  model,
  evalPath,
  skillsPath,
  mcpServerUrl,
  maxToolRounds = 15,
  debug = false,
}: SkillsRunnerArgs): Promise<RunnerResult> {
  const languageModel = resolveModel(provider, model)
  if (!languageModel) {
    return ERR(new Error(`Unsupported: ${provider}/${model}`))
  }

  let mcpClient: Awaited<ReturnType<typeof connectMCP>>['client'] | null = null

  try {
    // 1. Discover skills
    const skills = await discoverSkills(skillsPath)
    if (skills.length === 0) {
      return ERR(new Error(`No skills found at: ${skillsPath}`))
    }

    // 2. Build tools: loadSkill + optional MCP tools
    const loadSkill = createLoadSkillTool(skills)
    let tools: Record<string, ReturnType<typeof createLoadSkillTool>> = { loadSkill }

    if (mcpServerUrl) {
      const mcp = await connectMCP(mcpServerUrl)
      mcpClient = mcp.client
      tools = { ...mcp.tools, loadSkill }
    }

    // 3. Build system prompt with skill summaries
    const skillsPrompt = buildSkillsSystemPrompt(skills)
    const system = `${SYSTEM_PROMPT}\n\n${skillsPrompt}`

    // 4. Generate with tool support
    const prompt = await loadPrompt(evalPath)
    const response = await generateText({
      model: languageModel,
      prompt,
      system,
      tools,
      stopWhen: stepCountIs(maxToolRounds),
      maxTokens: 16384,
    })

    // 5. Collect text from all steps
    const fullResponse =
      response.steps
        ?.map((s) => s.text)
        .filter(Boolean)
        .join('\n\n') || response.text

    // 6. Run graders
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
