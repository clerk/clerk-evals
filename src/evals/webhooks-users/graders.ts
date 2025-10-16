import type { Graders } from "@/src/interfaces";
import { PATTERNS, SCORERS } from "@/src/scorers/constants";

export const graders = {
  imports_verify_webhook: async (actual) =>
    PATTERNS.CLERK_BACKEND_WEBHOOKS_IMPORT.test(actual),
  calls_verify_webhook: async (actual) =>
    PATTERNS.CLERK_BACKEND_WEBHOOKS_VERIFY_WEBHOOK.test(actual),
  mentions_env_secret: async (actual) =>
    actual.includes("CLERK_WEBHOOK_SIGNING_SECRET"),
  handles_user_updated: async (actual) =>
    actual.includes("user.updated"),
  handles_user_deleted: async (actual) =>
    actual.includes("user.deleted"),
  logs_user_id: async (actual) =>
    actual.includes("evt.data.id") || actual.includes("userId"),
  logs_primary_email: async (actual) =>
    actual.includes("primary_email") ||
    actual.includes("primaryEmailAddress") ||
    actual.includes("primaryEmail"),
  warns_on_delete: async (actual) =>
    actual.includes("console.warn") && actual.includes("user.deleted"),

  verify_webhook_called_correctly: SCORERS.VERIFY_WEBHOOK_CALLED_CORRECTLY,
  http_responses: SCORERS.HTTP_RESPONSES,
  no_svix: SCORERS.NO_SVIX,
} satisfies Graders;
