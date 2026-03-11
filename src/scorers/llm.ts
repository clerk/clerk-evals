import { ClosedQA, init } from 'autoevals'
import OpenAI from 'openai'

// Explicitly initialize openai for autoevals (LLM-as-judge)
init({
  // @ts-expect-error
  client: new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  }),
})

const DEFAULT_JUDGE_MODEL = 'gpt-4.1'

/** Configurable via EVAL_JUDGE_MODEL env var or --judge-model CLI flag */
const judgeModel = process.env.EVAL_JUDGE_MODEL || DEFAULT_JUDGE_MODEL

/** In-memory cache for identical (criteria + response) pairs within a run */
const judgeCache = new Map<string, boolean>()

export type LLMJudgeConfig =
  | string
  | {
      /** Prompt passed to the judge */
      criteria: string
      /** Optional supplemental input */
      input?: string
      /** Override the default judge model */
      model?: string
      /** Few-shot examples or rubric appended to input for judge context */
      examples?: string
    }

export const makeScorer = (config: LLMJudgeConfig) => {
  const {
    criteria,
    input: rawInput = '',
    model = judgeModel,
    examples,
  } = typeof config === 'string' ? { criteria: config } : config

  const input = examples ? `${rawInput}\n\n## Examples\n${examples}`.trim() : rawInput

  const scorer = ClosedQA.partial({
    model,
  })
  return async (actual: string) => {
    const cacheKey = `${model}::${criteria}::${actual.slice(0, 2000)}`
    const cached = judgeCache.get(cacheKey)
    if (cached !== undefined) return cached

    const score = await scorer({ input, output: actual, criteria })
    const result = score.score === 1
    judgeCache.set(cacheKey, result)
    return result
  }
}

export function getJudgeCacheStats() {
  return { size: judgeCache.size }
}
