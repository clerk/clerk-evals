import type { Provider } from '@/src/providers'

/**
 * Information about a specific model offered by a provider.
 *
 * @property provider The provider name (machine readable, e.g. "openai")
 * @property name The model name (machine readable, e.g. "gpt-4o")
 * @property label A friendly human-readable name (e.g. "GPT-4o (May 2024)")
 */
export type ModelInfo = {
  provider: Provider
  name: string
  label: string
}

/**
 * Mapping of each provider to its available models.
 *
 * @example
 * MODELS.openai // Array of OpenAI models
 * MODELS.anthropic // Array of Anthropic models
 * MODELS.vercel // Array of Vercel models
 */
type ProviderModels = {
  [provider in Provider]: ModelInfo[]
}

/**
 * Lists of supported models for each provider.
 * Used to look up display names and filter/iterate over supported models in the app.
 */
export const MODELS: ProviderModels = {
  openai: [
    { provider: 'openai', name: 'gpt-4o', label: 'GPT-4o' },
    { provider: 'openai', name: 'gpt-5', label: 'GPT-5' },
    { provider: 'openai', name: 'gpt-5-chat-latest', label: 'GPT-5 Chat' },
  ],
  anthropic: [
    { provider: 'anthropic', name: 'claude-sonnet-4-0', label: 'Claude Sonnet 4' },
    { provider: 'anthropic', name: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5' },
    { provider: 'anthropic', name: 'claude-opus-4-0', label: 'Claude Opus 4' },
    { provider: 'anthropic', name: 'claude-opus-4-5', label: 'Claude Opus 4.5' },
    { provider: 'anthropic', name: 'claude-haiku-4-5', label: 'Claude Haiku 4.5' },
  ],
  vercel: [{ provider: 'vercel', name: 'v0-1.5-md', label: 'v0-1.5-md' }],
  google: [
    { provider: 'google', name: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
    { provider: 'google', name: 'gemini-3-pro-preview', label: 'Gemini 3 Pro Preview' },
  ],
}

/**
 * Returns all models as a flat array.
 */
export function getAllModels(): ModelInfo[] {
  return Object.values(MODELS).flat()
}
