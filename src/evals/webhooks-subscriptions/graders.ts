import type { Graders } from "@/src/interfaces";
import { PATTERNS, SCORERS } from "@/src/scorers/constants";

export const graders = {
  imports_verify_webhook: async (actual) =>
    PATTERNS.CLERK_BACKEND_WEBHOOKS_IMPORT.test(actual),
  calls_verify_webhook: async (actual) => PATTERNS.CLERK_BACKEND_WEBHOOKS_VERIFY_WEBHOOK.test(actual),
  mentions_env_secret: async (actual) =>
    actual.includes("CLERK_WEBHOOK_SIGNING_SECRET"),
  handles_subscription_created: async (actual) =>
    actual.includes("subscription.created"),
  logs_payer_id: async (actual) =>
    actual.includes("evt.data.payerId") || actual.includes("payerId"),
  handles_subscription_past_due: async (actual) =>
    actual.includes("subscription.pastDue"),
  logs_subscription_id: async (actual) =>
    actual.includes("evt.data.id"),
  errors_on_past_due: async (actual) =>
    actual.includes("console.error") && actual.includes("subscription.pastDue"),
  references_status_field: async (actual) =>
    actual.includes("evt.data.status"),

  verify_webhook_called_correctly: SCORERS.VERIFY_WEBHOOK_CALLED_CORRECTLY,
  http_responses: SCORERS.HTTP_RESPONSES,
  no_svix: SCORERS.NO_SVIX,
} satisfies Graders;
