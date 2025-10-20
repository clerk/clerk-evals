import { contains, containsAny, defineGraders } from '@/src/graders'
import { PATTERNS, SCORERS } from '@/src/scorers/constants'

export const graders = defineGraders({
  imports_verify_webhook: async (actual) =>
    PATTERNS.CLERK_BACKEND_WEBHOOKS_IMPORT.test(actual),
  calls_verify_webhook: async (actual) =>
    PATTERNS.CLERK_BACKEND_WEBHOOKS_VERIFY_WEBHOOK.test(actual),
  mentions_env_secret: contains('CLERK_WEBHOOK_SIGNING_SECRET'),
  handles_subscription_created: contains('subscription.created'),
  logs_payer_id: containsAny(['evt.data.payerId', 'payerId']),
  handles_subscription_past_due: contains('subscription.pastDue'),
  logs_subscription_id: contains('evt.data.id'),
  errors_on_past_due: async (actual) =>
    (await contains('console.error')(actual)) &&
    (await contains('subscription.pastDue')(actual)),
  references_status_field: contains('evt.data.status'),
  verify_webhook_called_correctly: SCORERS.VERIFY_WEBHOOK_CALLED_CORRECTLY,
  http_responses: SCORERS.HTTP_RESPONSES,
  no_svix: SCORERS.NO_SVIX,
})
