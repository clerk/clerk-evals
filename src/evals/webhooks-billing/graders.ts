import type { Graders } from "@/src/interfaces";
import { PATTERNS, SCORERS } from "@/src/evals/constants";

const verifyImportPattern = PATTERNS.CLERK_BACKEND_WEBHOOKS_IMPORT;
const verifyCallPattern = PATTERNS.CLERK_BACKEND_WEBHOOKS_VERIFY_WEBHOOK;

export const graders = {
  imports_verify_webhook: async (actual) =>
    verifyImportPattern.test(actual.toString()),
  calls_verify_webhook: async (actual) => verifyCallPattern.test(actual),
  mentions_env_secret: async (actual) =>
    actual.includes("CLERK_WEBHOOK_SIGNING_SECRET"),
  handles_free_trial_event: async (actual) =>
    actual.includes("subscriptionItem.freeTrialEnding"),
  warns_on_free_trial: async (actual) =>
    actual.includes("console.warn") &&
    actual.includes("subscriptionItem.freeTrialEnding"),
  handles_payment_attempt: async (actual) =>
    actual.includes("paymentAttempt.updated"),
  inspects_failed_status: async (actual) =>
    /status\s*===?\s*["'`]failed["'`]/.test(actual),
  logs_payment_type: async (actual) =>
    actual.includes("evt.data.type") || actual.includes("attempt.type"),
  uses_console_error_for_failures: async (actual) =>
    actual.includes("console.error"),

  http_responses: SCORERS.HTTP_RESPONSES,
  verify_webhook_called_correctly: SCORERS.VERIFY_WEBHOOK_CALLED_CORRECTLY,
  does_not_use_svix: SCORERS.NO_SVIX,
} satisfies Graders;
