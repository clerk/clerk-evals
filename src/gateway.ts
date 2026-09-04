export const VERCEL_AI_GATEWAY_URL = 'https://ai-gateway.vercel.sh'
export const VERCEL_AI_GATEWAY_OPENAI_URL = `${VERCEL_AI_GATEWAY_URL}/v1`
export const VERCEL_AI_GATEWAY_KEY_ENV = 'VERCEL_AI_GATEWAY_API_KEY'

/**
 * Prefer the repository-specific key name, but accept Vercel's standard key
 * and OIDC names so CI and Vercel-hosted runs do not need extra aliases.
 */
export function getGatewayCredential(): string | undefined {
  return (
    process.env.VERCEL_AI_GATEWAY_API_KEY ??
    process.env.AI_GATEWAY_API_KEY ??
    process.env.VERCEL_OIDC_TOKEN
  )
}

export function requireGatewayCredential(): string {
  const credential = getGatewayCredential()
  if (!credential) {
    throw new Error(
      'Missing VERCEL_AI_GATEWAY_API_KEY. Set it before running model-backed evaluations.',
    )
  }
  return credential
}
