import { createAnthropic, type AnthropicProvider } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI, type GoogleGenerativeAIProvider } from '@ai-sdk/google'
import { createOpenAI, type OpenAIProvider } from '@ai-sdk/openai'
import { createVercel, type VercelProvider } from '@ai-sdk/vercel'

export type ProviderOpenAI = 'openai'
export type ProviderAnthropic = 'anthropic'
export type ProviderVercel = 'vercel'
export type ProviderGoogle = 'google'
export type Provider = ProviderOpenAI | ProviderAnthropic | ProviderVercel | ProviderGoogle

export type ModelIdsOpenAI = Parameters<OpenAIProvider['chat']>[0]
export type ModelIdsAnthropic = Parameters<AnthropicProvider['chat']>[0]
export type ModelIdsVercel = Parameters<VercelProvider['languageModel']>[0]
export type ModelIdsGoogle = Parameters<GoogleGenerativeAIProvider['chat']>[0]

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const vercel = createVercel({
  apiKey: process.env.V0_API_KEY,
})

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_API_KEY,
})

export function getModel(provider: Provider, model: string) {
  if (provider === 'openai') {
    return openai(model)
  } else if (provider === 'anthropic') {
    return anthropic(model)
  } else if (provider === 'vercel') {
    return vercel(model)
  } else if (provider === 'google') {
    return google(model)
  }
}
