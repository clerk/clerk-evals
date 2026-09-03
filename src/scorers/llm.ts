import { createHash } from 'node:crypto'
import { ClosedQA } from 'autoevals'

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
    openAiApiKey: process.env.OPENAI_API_KEY,
    openAiBaseUrl: process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1',
  })
  return async (actual: string) => {
    const responseHash = createHash('sha256').update(actual).digest('hex')
    const cacheKey = `${model}::${criteria}::${responseHash}`
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
