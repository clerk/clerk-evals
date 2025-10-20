import { contains, containsAny, defineGraders } from '@/src/graders'
import { PATTERNS, SCORERS } from '@/src/scorers/constants'

export const graders = defineGraders({
  imports_verify_webhook: async (actual) =>
    PATTERNS.CLERK_BACKEND_WEBHOOKS_IMPORT.test(actual),
  calls_verify_webhook: async (actual) =>
    PATTERNS.CLERK_BACKEND_WEBHOOKS_VERIFY_WEBHOOK.test(actual),
  mentions_env_secret: contains('CLERK_WEBHOOK_SIGNING_SECRET'),
  handles_user_updated: contains('user.updated'),
  handles_user_deleted: contains('user.deleted'),
  logs_user_id: containsAny(['evt.data.id', 'userId']),
  logs_primary_email: containsAny([
    'primary_email',
    'primaryEmailAddress',
    'primaryEmail',
  ]),
  warns_on_delete: async (actual) =>
    (await contains('console.warn')(actual)) && (await contains('user.deleted')(actual)),
  verify_webhook_called_correctly: SCORERS.VERIFY_WEBHOOK_CALLED_CORRECTLY,
  http_responses: SCORERS.HTTP_RESPONSES,
  no_svix: SCORERS.NO_SVIX,
})
