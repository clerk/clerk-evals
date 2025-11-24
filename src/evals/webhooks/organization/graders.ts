import { contains, containsAny, defineGraders } from '@/src/graders'
import { PATTERNS, SCORERS } from '@/src/scorers/constants'

const verifyImportPattern = PATTERNS.CLERK_BACKEND_WEBHOOKS_IMPORT
const verifyCallPattern = PATTERNS.CLERK_BACKEND_WEBHOOKS_VERIFY_WEBHOOK

export const graders = defineGraders({
  imports_verify_webhook: async (actual) => verifyImportPattern.test(actual),
  calls_verify_webhook: async (actual) => verifyCallPattern.test(actual),
  mentions_env_secret: contains('CLERK_WEBHOOK_SIGNING_SECRET'),
  handles_membership_created: contains('organizationMembership.created'),
  handles_membership_deleted: contains('organizationMembership.deleted'),
  logs_membership_id: containsAny(['evt.data.id', 'membership.id']),
  logs_org_id: containsAny(['evt.data.organization.id', 'organizationId']),
  references_public_user_data: contains('publicUserData'),
  http_responses: SCORERS.HTTP_RESPONSES,
  does_not_use_svix: SCORERS.NO_SVIX,
  verify_webhook_called_correctly: SCORERS.VERIFY_WEBHOOK_CALLED_CORRECTLY,
})
