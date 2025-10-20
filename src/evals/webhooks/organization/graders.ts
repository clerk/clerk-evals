import type { Graders } from '@/src/interfaces'
import { PATTERNS, SCORERS } from '@/src/scorers/constants'

const verifyImportPattern = PATTERNS.CLERK_BACKEND_WEBHOOKS_IMPORT
const verifyCallPattern = PATTERNS.CLERK_BACKEND_WEBHOOKS_VERIFY_WEBHOOK

export const graders = {
  imports_verify_webhook: async (actual) => verifyImportPattern.test(actual.toString()),
  calls_verify_webhook: async (actual) => verifyCallPattern.test(actual),
  mentions_env_secret: async (actual) => actual.includes('CLERK_WEBHOOK_SIGNING_SECRET'),
  handles_membership_created: async (actual) => actual.includes('organizationMembership.created'),
  handles_membership_deleted: async (actual) => actual.includes('organizationMembership.deleted'),
  logs_membership_id: async (actual) =>
    actual.includes('evt.data.id') || actual.includes('membership.id'),
  logs_org_id: async (actual) =>
    actual.includes('evt.data.organization.id') || actual.includes('organizationId'),
  references_public_user_data: async (actual) => actual.includes('publicUserData'),

  http_responses: SCORERS.HTTP_RESPONSES,
  does_not_use_svix: SCORERS.NO_SVIX,
  verify_webhook_called_correctly: SCORERS.VERIFY_WEBHOOK_CALLED_CORRECTLY,
} satisfies Graders
