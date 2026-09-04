import { contains, defineGraders } from '@/src/graders'
import { PATTERNS } from '@/src/scorers/constants'

function readBalancedBlock(actual: string, openingBrace: number): string | null {
  let depth = 0
  for (let index = openingBrace; index < actual.length; index += 1) {
    const character = actual[index]
    if (character === '{') depth += 1
    if (character === '}') depth -= 1
    if (depth === 0) return actual.slice(openingBrace + 1, index)
  }
  return null
}

function findEventScope(actual: string, eventType: string): string | null {
  const event = eventType.replace('.', '\\.')
  const branchPattern = new RegExp(
    `(?:evt|event)\\.type\\s*={2,3}\\s*['"]${event}['"]\\s*\\)?\\s*\\{`,
  )
  const branch = branchPattern.exec(actual)
  if (branch) {
    const openingBrace = actual.indexOf('{', branch.index)
    return readBalancedBlock(actual, openingBrace)
  }

  const casePattern = new RegExp(`case\\s+['"]${event}['"]\\s*:`)
  const caseMatch = casePattern.exec(actual)
  if (!caseMatch) return null

  const start = caseMatch.index + caseMatch[0].length
  const rest = actual.slice(start)
  const nextCase = /\b(?:case\s+['"]|default\s*:)/.exec(rest)
  return nextCase ? rest.slice(0, nextCase.index) : rest
}

function hasPayloadLog(scope: string | null, method: 'log' | 'warn'): boolean {
  if (!scope) return false
  return (
    new RegExp(`console\\.${method}\\s*\\(`).test(scope) &&
    /JSON\.stringify\s*\(/.test(scope) &&
    /\b(?:evt|event)\.data\b/.test(scope)
  )
}

function catchReturnsClientError(actual: string): boolean {
  const match = /catch(?:\s*\([^)]*\))?\s*\{/.exec(actual)
  if (!match) return false
  const openingBrace = actual.indexOf('{', match.index)
  const block = readBalancedBlock(actual, openingBrace)
  return block !== null && /status\s*:\s*4\d\d/.test(block)
}

export const graders = defineGraders({
  imports_verify_webhook: async (actual) => PATTERNS.CLERK_BACKEND_WEBHOOKS_IMPORT.test(actual),
  calls_verify_webhook: async (actual) =>
    PATTERNS.CLERK_BACKEND_WEBHOOKS_VERIFY_WEBHOOK.test(actual),
  mentions_env_secret: contains('CLERK_WEBHOOK_SIGNING_SECRET'),
  handles_email_created: async (actual) => findEventScope(actual, 'email.created') !== null,
  logs_email_payload: async (actual) =>
    hasPayloadLog(findEventScope(actual, 'email.created'), 'log'),
  handles_sms_created: async (actual) => findEventScope(actual, 'sms.created') !== null,
  warns_sms_payload: async (actual) => hasPayloadLog(findEventScope(actual, 'sms.created'), 'warn'),
  mentions_event_id: async (actual) => {
    const scope = findEventScope(actual, 'email.created')
    return scope !== null && /\b(?:evt|event)\.id\b|\beventId\b/.test(scope)
  },
  verify_webhook_called_correctly: async (actual) =>
    /await\s+verifyWebhook\s*\(\s*(?:request|req)\s*\)/.test(actual),
  http_responses: async (actual) =>
    /status\s*:\s*200/.test(actual) && catchReturnsClientError(actual),
  no_svix: async (actual) => !/\bsvix\b/i.test(actual),
  does_not_require_clerk_auth: async (actual) => !/\b(?:auth|currentUser)\s*\(/.test(actual),
})
