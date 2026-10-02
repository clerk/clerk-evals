import { createHash } from 'node:crypto'
import { ClosedQA } from 'autoevals'
import type { Grader } from '@/src/graders'
import { requireGatewayCredential, VERCEL_AI_GATEWAY_OPENAI_URL } from '@/src/gateway'

const DEFAULT_JUDGE_MODEL = 'openai/gpt-5.6-luna'

/** Configurable via EVAL_JUDGE_MODEL env var or --judge-model CLI flag */
const judgeModel = process.env.EVAL_JUDGE_MODEL || DEFAULT_JUDGE_MODEL

/** In-memory cache for identical (criteria + response) pairs within a run */
const judgeCache = new Map<string, boolean>()
const API_BACKED_GRADER: unique symbol = Symbol('api-backed-grader')

type ApiBackedGrader = Grader & {
  readonly [API_BACKED_GRADER]: true
}

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
    openAiApiKey: requireGatewayCredential(),
    openAiBaseUrl: VERCEL_AI_GATEWAY_OPENAI_URL,
  })
  const grader = async (actual: string) => {
    const responseHash = createHash('sha256').update(actual).digest('hex')
    const cacheKey = `${model}::${criteria}::${responseHash}`
    const cached = judgeCache.get(cacheKey)
    if (cached !== undefined) return cached

    const score = await scorer({ input, output: actual, criteria })
    const result = score.score === 1
    judgeCache.set(cacheKey, result)
    return result
  }

  Object.defineProperty(grader, API_BACKED_GRADER, { value: true })
  return grader as ApiBackedGrader
}

export function isApiBackedGrader(grader: Grader): boolean {
  return API_BACKED_GRADER in grader
}

export function getJudgeCacheStats() {
  return { size: judgeCache.size }
}
