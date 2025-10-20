import { contains, containsAny, defineGraders, matches } from '@/src/graders'
import { PATTERNS, SCORERS } from '@/src/scorers/constants'

const verifyImportPattern = PATTERNS.CLERK_BACKEND_WEBHOOKS_IMPORT
const verifyCallPattern = PATTERNS.CLERK_BACKEND_WEBHOOKS_VERIFY_WEBHOOK

export const graders = defineGraders({
  imports_verify_webhook: async (actual) => verifyImportPattern.test(actual),
  calls_verify_webhook: async (actual) => verifyCallPattern.test(actual),
  mentions_env_secret: contains('CLERK_WEBHOOK_SIGNING_SECRET'),
  handles_free_trial_event: contains('subscriptionItem.freeTrialEnding'),
  warns_on_free_trial: async (actual) =>
    (await contains('console.warn')(actual)) &&
    (await contains('subscriptionItem.freeTrialEnding')(actual)),
  handles_payment_attempt: contains('paymentAttempt.updated'),
  inspects_failed_status: matches(/status\s*===?\s*['"`]failed['"`]/),
  logs_payment_type: containsAny(['evt.data.type', 'attempt.type']),
  uses_console_error_for_failures: contains('console.error'),
  http_responses: SCORERS.HTTP_RESPONSES,
  verify_webhook_called_correctly: SCORERS.VERIFY_WEBHOOK_CALLED_CORRECTLY,
  does_not_use_svix: SCORERS.NO_SVIX,
})
