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
import { formatErrorDetails } from '@/src/utils/error'
import { getFinishPolicy } from './finish-policy'
import {
  computeScore,
  loadGraders,
  loadPrompt,
  resolveModel,
  runGraders,
  SYSTEM_PROMPT,
} from './shared'
import { getEvalTaskTimeoutMs, getMaxOutputTokens } from './timeout'

// Initialize Braintrust tracing in worker process (opt-in via env var).
// wrapAISDK auto-traces model calls including tool invocations.
if (process.env.BRAINTRUST_API_KEY) {
  initLogger({
    projectName: process.env.BRAINTRUST_PROJECT || 'clerk-evals',
    apiKey: process.env.BRAINTRUST_API_KEY,
  })
}

const { streamText } = wrapAISDK(ai)
const { stepCountIs } = ai

export default async function exec({
  provider,
  model,
  evalPath,
  variant,
  debug = false,
  mcpServerUrl,
  skillsPath,
  maxToolRounds,
  maxOutputTokens,
  maxRetries,
  timeoutMs,
}: ExecArgs): Promise<RunnerResult> {
  const languageModel = resolveModel(provider, model)
  if (!languageModel) {
    return ERR(new Error(`Unsupported: ${provider}/${model}`))
  }

  let mcpClient: MCPClient | null = null
  let generationStartedAt: number | undefined
  let generationAbortSignal: AbortSignal | undefined
  let streamError: unknown

  try {
    // 1. Collect tools from all providers
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
    const prompt = await loadPrompt(evalPath, variant)

    // 4. Generate text
    const hasTools = Object.keys(tools).length > 0
    const effectiveMaxRounds = maxToolRounds ?? (skillsPath ? 15 : 10)
    const effectiveTimeoutMs = getEvalTaskTimeoutMs(timeoutMs ?? process.env.EVAL_TASK_TIMEOUT_MS)
    const effectiveMaxRetries = maxRetries ?? 2
    const effectiveMaxOutputTokens = getMaxOutputTokens(
      maxOutputTokens ?? process.env.EVAL_MAX_OUTPUT_TOKENS,
    )
    generationAbortSignal = AbortSignal.timeout(effectiveTimeoutMs)

    if (debug) {
      console.error(
        '[DEBUG-eval-timeout] generation-start',
        JSON.stringify({
          provider,
          model,
          evalPath,
          variant,
          mode: skillsPath
            ? mcpServerUrl
              ? 'skills-mcp'
              : 'skills'
            : mcpServerUrl
              ? 'mcp'
              : 'baseline',
          timeoutMs: effectiveTimeoutMs,
          maxRetries: effectiveMaxRetries,
          requestedMaxOutputTokens: maxOutputTokens,
          effectiveMaxOutputTokens,
          maxToolRounds: hasTools ? effectiveMaxRounds : undefined,
          toolCount: Object.keys(tools).length,
        }),
      )
    }

    const startTime = performance.now()
    generationStartedAt = startTime
    let chunkCount = 0
    const response = streamText({
      model: languageModel,
      prompt,
      system,
      abortSignal: generationAbortSignal,
      maxRetries: effectiveMaxRetries,
      maxOutputTokens: effectiveMaxOutputTokens,
      ...(hasTools && {
        tools,
        stopWhen: stepCountIs(effectiveMaxRounds),
      }),
      onError: ({ error }) => {
        streamError = error
        if (debug) {
          console.error('[DEBUG-eval-timeout] stream-error', formatErrorDetails(error))
        }
      },
      ...(debug && {
        onChunk: ({ chunk }) => {
          chunkCount++
          if (chunkCount === 1) {
            console.error(
              '[DEBUG-eval-timeout] first-chunk',
              JSON.stringify({
                type: chunk.type,
                elapsedMs: Math.round(performance.now() - startTime),
              }),
            )
          }
        },
        onLanguageModelCallStart: ({ callId, provider, modelId }) => {
          console.error(
            '[DEBUG-eval-timeout] model-call-start',
            JSON.stringify({
              callId,
              provider,
              modelId,
              elapsedMs: Math.round(performance.now() - startTime),
            }),
          )
        },
        onLanguageModelCallEnd: ({ callId, finishReason, usage, performance: callPerformance }) => {
          console.error(
            '[DEBUG-eval-timeout] model-call-end',
            JSON.stringify({
              callId,
              finishReason,
              usage,
              performance: callPerformance,
              elapsedMs: Math.round(performance.now() - startTime),
            }),
          )
        },
        onStepEnd: ({ finishReason, usage, toolCalls, toolResults }) => {
          console.error(
            '[DEBUG-eval-timeout] step-end',
            JSON.stringify({
              finishReason,
              usage,
              toolCalls: toolCalls.length,
              toolResults: toolResults.length,
              elapsedMs: Math.round(performance.now() - startTime),
            }),
          )
        },
      }),
    })

    const [steps, responseText, finishReason, totalUsage] = await Promise.all([
      response.steps,
      response.text,
      response.finishReason,
      response.totalUsage,
    ])
    if (debug) {
      console.error(
        '[DEBUG-eval-timeout] stream-end',
        JSON.stringify({
          finishReason,
          steps: steps.length,
          textChars: responseText.length,
          chunkCount,
          usage: totalUsage,
          elapsedMs: Math.round(performance.now() - startTime),
        }),
      )
    }
    if (streamError) throw streamError

    // 5. Extract response text and check for truncation
    const fullResponse = hasTools
      ? steps
          .map((s) => s.text)
          .filter(Boolean)
          .join('\n\n') || responseText
      : responseText

    const finishPolicy = getFinishPolicy(finishReason)
    if (finishPolicy.truncated) {
      console.warn(
        `[truncated] ${provider}/${model} -> ${evalPath}: grading ${fullResponse.length} available characters`,
      )
    }

    // 6. Grade
    const graders = await loadGraders(evalPath, variant)
    const graderResults = await runGraders(graders, fullResponse)
    const score = computeScore(graderResults)

    // 7. Extract token usage and duration
    const durationMs = Math.round(performance.now() - startTime)
    const { inputTokens = 0, outputTokens = 0 } = totalUsage
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
          ? {
              ...buildMCPDebugPayload({ steps }, prompt, fullResponse, graderResults),
              finishReason,
            }
          : { prompt, response: fullResponse, graders: graderResults, finishReason }
        : undefined,
    })
  } catch (error) {
    if (debug) {
      console.error(
        '[DEBUG-eval-timeout] generation-error',
        JSON.stringify({
          provider,
          model,
          evalPath,
          elapsedMs:
            generationStartedAt === undefined
              ? undefined
              : Math.round(performance.now() - generationStartedAt),
          aborted: generationAbortSignal?.aborted ?? false,
          abortReason: generationAbortSignal?.reason
            ? formatErrorDetails(generationAbortSignal.reason)
            : undefined,
        }),
      )
      console.error('[DEBUG-eval-timeout] error-details', formatErrorDetails(error))
    }
    return ERR(error)
  } finally {
    await mcpClient?.close()
  }
}
