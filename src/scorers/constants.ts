import { makeScorer } from '@/src/scorers/llm'

export const PATTERNS = {
  CLERK_BACKEND_WEBHOOKS_IMPORT: /from ['"]@clerk\/backend\/webhooks['"]/,
  CLERK_BACKEND_WEBHOOKS_VERIFY_WEBHOOK: /await\s+verifyWebhook\s*\(/,
}

const PROMPT_NO_SVIX = 'Does the solution not use Svix anywhere?'
const PROMPT_VERIFY_WEBHOOK_CALLED_CORRECTLY =
  'Does the solution call verifyWebhook with a single request parameter?'
const PROMPT_HTTP_RESPONSES =
  'After verification, does the handler return a 200 response, and does it return a 400-level response when verification fails?'

export const SCORERS = {
  NO_SVIX: makeScorer(PROMPT_NO_SVIX),
  VERIFY_WEBHOOK_CALLED_CORRECTLY: makeScorer(PROMPT_VERIFY_WEBHOOK_CALLED_CORRECTLY),
  HTTP_RESPONSES: makeScorer(PROMPT_HTTP_RESPONSES),
}
