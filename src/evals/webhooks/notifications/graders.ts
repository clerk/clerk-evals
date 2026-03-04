import { all, contains, containsAny, defineGraders } from '@/src/graders'
import { PATTERNS, SCORERS } from '@/src/scorers/constants'

export const graders = defineGraders({
  imports_verify_webhook: async (actual) => PATTERNS.CLERK_BACKEND_WEBHOOKS_IMPORT.test(actual),
  calls_verify_webhook: async (actual) =>
    PATTERNS.CLERK_BACKEND_WEBHOOKS_VERIFY_WEBHOOK.test(actual),
  mentions_env_secret: contains('CLERK_WEBHOOK_SIGNING_SECRET'),
  handles_email_created: contains('email.created'),
  logs_email_payload: all(
    contains('console.log'),
    contains('email.created'),
    contains('JSON.stringify'),
  ),
  handles_sms_created: contains('sms.created'),
  warns_sms_payload: all(
    contains('console.warn'),
    contains('sms.created'),
    contains('JSON.stringify'),
  ),
  mentions_event_id: containsAny(['evt.data.id', 'eventId']),
  verify_webhook_called_correctly: SCORERS.VERIFY_WEBHOOK_CALLED_CORRECTLY,
  http_responses: SCORERS.HTTP_RESPONSES,
  no_svix: SCORERS.NO_SVIX,
})
