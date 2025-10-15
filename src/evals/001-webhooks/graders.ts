import type { Graders } from "@/src/interfaces";
import { makeScorer } from "@/src/scorers/llm";

export const graders = {
  // hard checks
  imports_verify_webhook: async (actual) =>
    actual.includes("from '@clerk/nextjs/webhooks'") ||
    actual.includes('from "@clerk/nextjs/webhooks"'),
  calls_verify_webhook: async (actual) =>
    /await\s+verifyWebhook\s*\(/.test(actual),
  references_webhook_route: async (actual) =>
    actual.includes("app/api/webhooks/route.ts") ||
    actual.includes("pages/api/webhooks.ts"),
  handles_user_created: async (actual) =>
    actual.toLowerCase().includes("user.created"),
  mentions_signing_secret_env: async (actual) =>
    actual.includes("CLERK_WEBHOOK_SIGNING_SECRET"),

  // llm-as-judge checks
  logs_user_identifiers: makeScorer(
    "When the webhook receives a user.created event, does the solution log both the Clerk user's id and email address from the verified payload?"
  ),
  structures_nextjs_handler: makeScorer(
    "Does the solution provide a Next.js Route Handler that verifies the webhook, returns a 200 response on success, and a 400-level response when verification fails?"
  ),
} satisfies Graders;
