import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createVercel } from "@ai-sdk/vercel";

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const vercel = createVercel({
  apiKey: process.env.VERCEL_API_KEY,
});

export function getModel(provider: string, model: string) {
  if (provider === "openai") {
    return openai(model);
  } else if (provider === "anthropic") {
    return anthropic(model);
  } else if (provider === "vercel") {
    return vercel(model);
  }
}
