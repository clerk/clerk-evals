import type {
  Provider,
  ProviderAnthropic,
  ProviderGoogle,
  ProviderOpenAI,
  ProviderVercel,
  ModelIdsOpenAI,
  ModelIdsAnthropic,
  ModelIdsVercel,
  ModelIdsGoogle,
} from '@/src/providers'

/**
 * Information about a specific model offered by a provider.
 *
 * @property provider The provider name (machine readable, e.g. "openai")
 * @property name The model name (machine readable, e.g. "gpt-4o")
 * @property label A friendly human-readable name (e.g. "GPT-4o (May 2024)")
 */
export type ModelInfo =
  | {
      provider: ProviderOpenAI
      name: ModelIdsOpenAI
      label: string
    }
  | {
      provider: ProviderAnthropic
      name: ModelIdsAnthropic
      label: string
    }
  | {
      provider: ProviderVercel
      name: ModelIdsVercel
      label: string
    }
  | {
      provider: ProviderGoogle
      name: ModelIdsGoogle
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
    { provider: 'openai', name: 'gpt-5.1', label: 'GPT-5.1' },
    { provider: 'openai', name: 'gpt-5.2', label: 'GPT-5.2' },
    { provider: 'openai', name: 'gpt-5.2-pro', label: 'GPT-5.2 Pro' },
    { provider: 'openai', name: 'gpt-5.3-codex', label: 'GPT-5.3 Codex' },
    { provider: 'openai', name: 'gpt-5.4', label: 'GPT-5.4' },
    { provider: 'openai', name: 'gpt-5.4-mini', label: 'GPT-5.4 Mini' },
    { provider: 'openai', name: 'gpt-5.4-nano', label: 'GPT-5.4 Nano' },
    { provider: 'openai', name: 'gpt-5.4-pro', label: 'GPT-5.4 Pro' },
    { provider: 'openai', name: 'gpt-5.5', label: 'GPT-5.5' },
    { provider: 'openai', name: 'gpt-5.5-pro', label: 'GPT-5.5 Pro' },
    { provider: 'openai', name: 'gpt-5.6-sol', label: 'GPT-5.6 Sol' },
    { provider: 'openai', name: 'gpt-5.6-terra', label: 'GPT-5.6 Terra' },
    { provider: 'openai', name: 'gpt-5.6-luna', label: 'GPT-5.6 Luna' },
  ],
  anthropic: [
    { provider: 'anthropic', name: 'claude-fable-5-1', label: 'Claude Fable 5.1' },
    { provider: 'anthropic', name: 'claude-fable-5', label: 'Claude Fable 5' },
    { provider: 'anthropic', name: 'claude-opus-5', label: 'Claude Opus 5' },
    { provider: 'anthropic', name: 'claude-sonnet-5', label: 'Claude Sonnet 5' },
    { provider: 'anthropic', name: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5' },
    { provider: 'anthropic', name: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
    { provider: 'anthropic', name: 'claude-opus-4-5', label: 'Claude Opus 4.5' },
    { provider: 'anthropic', name: 'claude-opus-4-6', label: 'Claude Opus 4.6' },
    { provider: 'anthropic', name: 'claude-opus-4-7', label: 'Claude Opus 4.7' },
    { provider: 'anthropic', name: 'claude-opus-4-8', label: 'Claude Opus 4.8' },
    { provider: 'anthropic', name: 'claude-haiku-4-5', label: 'Claude Haiku 4.5' },
  ],
  vercel: [],
  google: [
    { provider: 'google', name: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash' },
    { provider: 'google', name: 'gemini-3.7-flash', label: 'Gemini 3.7 Flash' },
    { provider: 'google', name: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash' },
    { provider: 'google', name: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash-Lite' },
    { provider: 'google', name: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro Preview' },
    { provider: 'google', name: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash-Lite' },
    { provider: 'google', name: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
    { provider: 'google', name: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
    { provider: 'google', name: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash-Lite' },
    { provider: 'google', name: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash' },
  ],
}

/**
 * Returns all models as a flat array.
 */
export function getAllModels(): ModelInfo[] {
  return Object.values(MODELS).flat()
}

/**
 * Returns models for a specific provider.
 */
export function getModelsByProvider(provider: Provider): ModelInfo[] {
  return MODELS[provider] ?? []
}
