import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createVercel } from "@ai-sdk/vercel";

/**
 * Supported language model providers.
 * - "openai": For OpenAI models (e.g. GPT-4o, GPT-5, etc.)
 * - "anthropic": For Anthropic models (e.g. Claude, Sonnet, Opus, etc.)
 * - "vercel": For Vercel AI models (e.g. v0-1.5-md)
 */
export type Provider = "openai" | "anthropic" | "vercel";

/**
 * Information about a specific model offered by a provider.
 *
 * @property provider The provider name (machine readable, e.g. "openai")
 * @property name The model name (machine readable, e.g. "gpt-4o")
 * @property label A friendly human-readable name (e.g. "GPT-4o (May 2024)")
 */
export type ModelInfo = {
  provider: Provider;
  name: string;
  label: string;
};

/**
 * Mapping of each provider to its available models.
 *
 * @example
 * MODELS.openai // Array of OpenAI models
 * MODELS.anthropic // Array of Anthropic models
 * MODELS.vercel // Array of Vercel models
 */
export type ProviderModels = {
  [provider in Provider]: ModelInfo[];
};

/**
 * Lists of supported models for each provider.
 * Used to look up display names and filter/iterate over supported models in the app.
 */
export const MODELS: ProviderModels = {
  openai: [
    { provider: "openai", name: "gpt-4o", label: "GPT-4o" },
    { provider: "openai", name: "gpt-5", label: "GPT-5" },
    { provider: "openai", name: "gpt-5-chat-latest", label: "GPT-5 (Chat, Latest)" },
  ],
  anthropic: [
    { provider: "anthropic", name: "claude-sonnet-4-0", label: "Claude Sonnet 4.0" },
    { provider: "anthropic", name: "claude-sonnet-4-5", label: "Claude Sonnet 4.5" },
    { provider: "anthropic", name: "claude-opus-4-0", label: "Claude Opus 4.0" },
  ],
  vercel: [
    { provider: "vercel", name: "v0-1.5-md", label: "v0-1.5-md" },
  ],
};

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const vercel = createVercel({
  apiKey: process.env.VERCEL_API_KEY,
});

export function getModel(provider: Provider, model: string) {
  if (provider === "openai") {
    return openai(model);
  } else if (provider === "anthropic") {
    return anthropic(model);
  } else if (provider === "vercel") {
    return vercel(model);
  }
}
