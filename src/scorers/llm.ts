import { ClosedQA, init } from 'autoevals'
import OpenAI from 'openai'

// Explicitly initialize openai for autoevals (LLM-as-judge)
init({
  // @ts-expect-error
  client: new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  }),
})

const MODEL_FOR_BRAINTRUST_LLM_AS_JUDGE = 'gpt-4.1'

export type LLMJudgeConfig =
  | string
  | {
      /** Prompt passed to the judge */
      criteria: string
      /** Optional supplemental input */
      input?: string
      /** Override the default judge model */
      model?: string
    }

export const makeScorer = (config: LLMJudgeConfig) => {
  const {
    criteria,
    input = '',
    model = MODEL_FOR_BRAINTRUST_LLM_AS_JUDGE,
  } = typeof config === 'string' ? { criteria: config } : config

  const scorer = ClosedQA.partial({
    model,
  })
  return async (actual: string) => {
    const score = await scorer({ input, output: actual, criteria })
    return score.score === 1
  }
}
