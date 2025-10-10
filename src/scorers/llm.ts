import OpenAI from "openai";
import { init, ClosedQA } from "autoevals";

// Explicitly initialize openai for autoevals (LLM-as-judge)
init({
  // @ts-ignore
  client: new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  }),
});

const MODEL_FOR_BRAINTRUST_LLM_AS_JUDGE = "gpt-4.1";

export const makeScorer = (criteria: string) => {
  const scorer = ClosedQA.partial({
    model: MODEL_FOR_BRAINTRUST_LLM_AS_JUDGE,
  });
  return async (actual: string) => {
    const score = await scorer({ input: "", output: actual, criteria });
    return score.score === 1;
  };
};
