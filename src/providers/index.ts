import { createGateway } from 'ai'
import { getModelInfo } from '@/src/config/models'
import { getGatewayCredential } from '@/src/gateway'

export type ProviderOpenAI = 'openai'
export type ProviderAnthropic = 'anthropic'
export type ProviderGoogle = 'google'
export type ProviderXAI = 'x-ai'
export type ProviderMoonshotAI = 'moonshotai'
export type ProviderTencent = 'tencent'
export type Provider =
  | ProviderOpenAI
  | ProviderAnthropic
  | ProviderGoogle
  | ProviderXAI
  | ProviderMoonshotAI
  | ProviderTencent

const credential = getGatewayCredential()
const gateway = createGateway(credential ? { apiKey: credential } : undefined)

export function getModel(provider: Provider, model: string) {
  const modelInfo = getModelInfo(provider, model)
  return modelInfo ? gateway(modelInfo.gatewayId) : undefined
}
