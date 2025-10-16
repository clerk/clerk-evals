import type { Graders } from "@/src/interfaces";
import { PATTERNS, SCORERS } from "@/src/scorers/constants";

export const graders = {
  imports_verify_webhook: async (actual) =>
    PATTERNS.CLERK_BACKEND_WEBHOOKS_IMPORT.test(actual),
  calls_verify_webhook: async (actual) => PATTERNS.CLERK_BACKEND_WEBHOOKS_VERIFY_WEBHOOK.test(actual),
  mentions_env_secret: async (actual) =>
    actual.includes("CLERK_WEBHOOK_SIGNING_SECRET"),
  handles_email_created: async (actual) =>
    actual.includes("email.created"),
  logs_email_payload: async (actual) =>
    actual.includes("console.log") && actual.includes("email.created") && actual.includes("JSON.stringify"),
  handles_sms_created: async (actual) =>
    actual.includes("sms.created"),
  warns_sms_payload: async (actual) =>
    actual.includes("console.warn") && actual.includes("sms.created") && actual.includes("JSON.stringify"),
  mentions_event_id: async (actual) =>
    actual.includes("evt.data.id") || actual.includes("eventId"),

  verify_webhook_called_correctly: SCORERS.VERIFY_WEBHOOK_CALLED_CORRECTLY,
  http_responses: SCORERS.HTTP_RESPONSES,
  no_svix: SCORERS.NO_SVIX,
} satisfies Graders;
