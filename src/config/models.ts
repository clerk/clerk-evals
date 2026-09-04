import type { Provider } from '@/src/providers'

export const MODEL_CUTOFF_DAYS = 90
const DAY_MS = 24 * 60 * 60 * 1000

/**
 * A model remains in the full catalog after it leaves the default run set.
 * Explicit runs can therefore reproduce old results without making each full
 * run pay for obsolete models.
 */
export type ModelInfo = {
  /** Model creator. This is not the transport provider. */
  provider: Provider
  /** Native provider model ID retained in score history and agent CLI calls. */
  name: string
  /** Vercel AI Gateway model ID. */
  gatewayId: string
  label: string
  /** Public release date in ISO YYYY-MM-DD form. */
  releasedAt: string
  /** Keep this model after the age cutoff because it is the creator's best model. */
  currentBest?: true
}

type ProviderModels = {
  [provider in Provider]: ModelInfo[]
}

const model = (
  provider: Provider,
  name: string,
  label: string,
  releasedAt: string,
  options: { gatewayProvider?: string; gatewayName?: string; currentBest?: true } = {},
): ModelInfo => ({
  provider,
  name,
  gatewayId: `${options.gatewayProvider ?? provider}/${options.gatewayName ?? name}`,
  label,
  releasedAt,
  ...(options.currentBest && { currentBest: true }),
})

export const MODELS: ProviderModels = {
  openai: [
    model('openai', 'gpt-4o', 'GPT-4o', '2024-05-13'),
    model('openai', 'gpt-5', 'GPT-5', '2025-08-07'),
    model('openai', 'gpt-5.1', 'GPT-5.1', '2025-11-13'),
    model('openai', 'gpt-5.2', 'GPT-5.2', '2025-12-11'),
    model('openai', 'gpt-5.2-pro', 'GPT-5.2 Pro', '2025-12-11'),
    model('openai', 'gpt-5.3-codex', 'GPT-5.3 Codex', '2026-02-05'),
    model('openai', 'gpt-5.4', 'GPT-5.4', '2026-03-05'),
    model('openai', 'gpt-5.4-mini', 'GPT-5.4 Mini', '2026-03-17'),
    model('openai', 'gpt-5.4-nano', 'GPT-5.4 Nano', '2026-03-17'),
    model('openai', 'gpt-5.4-pro', 'GPT-5.4 Pro', '2026-03-05'),
    model('openai', 'gpt-5.5', 'GPT-5.5', '2026-04-24'),
    model('openai', 'gpt-5.5-pro', 'GPT-5.5 Pro', '2026-04-24'),
    model('openai', 'gpt-5.6-sol', 'GPT-5.6 Sol', '2026-07-09', { currentBest: true }),
    model('openai', 'gpt-5.6-terra', 'GPT-5.6 Terra', '2026-07-09'),
    model('openai', 'gpt-5.6-luna', 'GPT-5.6 Luna', '2026-07-09'),
  ],
  anthropic: [
    model('anthropic', 'claude-fable-5-1', 'Claude Fable 5.1', '2026-08-31', {
      gatewayName: 'claude-fable-5.1',
      currentBest: true,
    }),
    model('anthropic', 'claude-fable-5', 'Claude Fable 5', '2026-07-01'),
    model('anthropic', 'claude-opus-5', 'Claude Opus 5', '2026-07-24'),
    model('anthropic', 'claude-sonnet-5', 'Claude Sonnet 5', '2026-06-29'),
    model('anthropic', 'claude-sonnet-4-5', 'Claude Sonnet 4.5', '2025-09-29', {
      gatewayName: 'claude-sonnet-4.5',
    }),
    model('anthropic', 'claude-sonnet-4-6', 'Claude Sonnet 4.6', '2026-02-17', {
      gatewayName: 'claude-sonnet-4.6',
    }),
    model('anthropic', 'claude-opus-4-5', 'Claude Opus 4.5', '2025-11-24', {
      gatewayName: 'claude-opus-4.5',
    }),
    model('anthropic', 'claude-opus-4-6', 'Claude Opus 4.6', '2026-02-05', {
      gatewayName: 'claude-opus-4.6',
    }),
    model('anthropic', 'claude-opus-4-7', 'Claude Opus 4.7', '2026-04-16', {
      gatewayName: 'claude-opus-4.7',
    }),
    model('anthropic', 'claude-opus-4-8', 'Claude Opus 4.8', '2026-05-28', {
      gatewayName: 'claude-opus-4.8',
    }),
    model('anthropic', 'claude-haiku-4-5', 'Claude Haiku 4.5', '2025-10-15', {
      gatewayName: 'claude-haiku-4.5',
    }),
  ],
  google: [
    model('google', 'gemini-3.8-flash', 'Gemini 3.8 Flash', '2026-09-02'),
    model('google', 'gemini-3.7-flash', 'Gemini 3.7 Flash', '2026-08-13'),
    model('google', 'gemini-3.6-flash', 'Gemini 3.6 Flash', '2026-07-21'),
    model('google', 'gemini-3.5-flash-lite', 'Gemini 3.5 Flash-Lite', '2026-07-21'),
    model('google', 'gemini-3.1-pro-preview', 'Gemini 3.1 Pro Preview', '2026-02-19', {
      currentBest: true,
    }),
    model('google', 'gemini-3.1-flash-lite', 'Gemini 3.1 Flash-Lite', '2026-05-07'),
    model('google', 'gemini-2.5-pro', 'Gemini 2.5 Pro', '2025-03-20'),
    model('google', 'gemini-2.5-flash', 'Gemini 2.5 Flash', '2025-03-20'),
    model('google', 'gemini-2.5-flash-lite', 'Gemini 2.5 Flash-Lite', '2025-06-17'),
    model('google', 'gemini-3.5-flash', 'Gemini 3.5 Flash', '2026-05-19'),
  ],
  'x-ai': [
    model('x-ai', 'grok-4.6', 'Grok 4.6', '2026-08-12', {
      gatewayProvider: 'spacexai',
      currentBest: true,
    }),
    model('x-ai', 'grok-4.5', 'Grok 4.5', '2026-07-08', {
      gatewayProvider: 'spacexai',
    }),
  ],
  moonshotai: [model('moonshotai', 'kimi-k3', 'Kimi K3', '2026-07-16')],
  tencent: [model('tencent', 'hy4-preview', 'Tencent Hy4 Preview', '2026-08-28')],
}

export type ModelEligibility = {
  included: boolean
  reason: 'recent' | 'current-best' | 'past-cutoff'
  ageDays: number
}

export function getModelEligibility(
  modelInfo: ModelInfo,
  options: { now?: Date; cutoffDays?: number } = {},
): ModelEligibility {
  const now = options.now ?? new Date()
  const cutoffDays = options.cutoffDays ?? MODEL_CUTOFF_DAYS
  const releasedAt = new Date(`${modelInfo.releasedAt}T00:00:00.000Z`)
  const ageDays = Math.max(0, Math.floor((now.getTime() - releasedAt.getTime()) / DAY_MS))

  if (modelInfo.currentBest) return { included: true, reason: 'current-best', ageDays }
  if (ageDays <= cutoffDays) return { included: true, reason: 'recent', ageDays }
  return { included: false, reason: 'past-cutoff', ageDays }
}

/** Return the full catalog, including models that only run when explicitly selected. */
export function getAllModels(): ModelInfo[] {
  return Object.values(MODELS).flat()
}

/** Return the routine run set selected by age and current-best status. */
export function getDefaultModels(options: { now?: Date; cutoffDays?: number } = {}): ModelInfo[] {
  return getAllModels().filter((entry) => getModelEligibility(entry, options).included)
}

export function getModelsByProvider(
  provider: Provider,
  options: { includeLegacy?: boolean; now?: Date; cutoffDays?: number } = {},
): ModelInfo[] {
  const models = MODELS[provider] ?? []
  return options.includeLegacy
    ? models
    : models.filter((entry) => getModelEligibility(entry, options).included)
}

export function getModelInfo(provider: Provider, name: string): ModelInfo | undefined {
  return MODELS[provider]?.find((entry) => entry.name === name)
}
