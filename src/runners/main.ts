import { generateText } from 'ai'
import type { RunnerArgs, RunnerResult } from '@/src/interfaces'
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
 * Baseline runner - executes evaluations without MCP tools.
 */
export default async function exec({
  provider,
  model,
  evalPath,
  debug = false,
}: RunnerArgs): Promise<RunnerResult> {
  const languageModel = resolveModel(provider, model)
  if (!languageModel) {
    return ERR(new Error(`Unsupported: ${provider}/${model}`))
  }

  try {
    const prompt = await loadPrompt(evalPath)

    const response = await generateText({
      model: languageModel,
      prompt,
      system: SYSTEM_PROMPT,
    })

    const graders = await loadGraders(evalPath)
    const graderResults = await runGraders(graders, response.text)
    const score = computeScore(graderResults)

    return OK({
      score,
      debug: debug
        ? {
            prompt,
            response: response.text,
            graders: graderResults,
          }
        : undefined,
    })
  } catch (error) {
    return ERR(error)
  }
}
