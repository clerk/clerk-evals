import { contains, containsAny, defineGraders, judge } from '@/src/graders'
import { PATTERNS, SCORERS } from '@/src/scorers/constants'

export const graders = defineGraders({
  imports_verify_webhook: async (actual) =>
    PATTERNS.CLERK_BACKEND_WEBHOOKS_IMPORT.test(actual),
  calls_verify_webhook: async (actual) =>
    PATTERNS.CLERK_BACKEND_WEBHOOKS_VERIFY_WEBHOOK.test(actual),
  references_webhook_route: containsAny([
    'app/api/webhooks/route.ts',
    'pages/api/webhooks.ts',
  ]),
  handles_user_created: contains('user.created'),
  mentions_signing_secret_env: contains('CLERK_WEBHOOK_SIGNING_SECRET'),
  logs_user_identifiers: judge(
    "When the webhook receives a user.created event, does the solution log both the Clerk user's id and email address from the verified payload?",
  ),
  structures_nextjs_handler: judge(
    'Does the solution provide a Next.js Route Handler that verifies the webhook, returns a 200 response on success, and a 400-level response when verification fails?',
  ),
  verify_webhook_called_correctly: SCORERS.VERIFY_WEBHOOK_CALLED_CORRECTLY,
  no_svix: SCORERS.NO_SVIX,
  http_responses: SCORERS.HTTP_RESPONSES,
})
