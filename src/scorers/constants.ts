import { makeScorer } from "@/src/scorers/llm";

export const PATTERNS = {
  CLERK_BACKEND_WEBHOOKS_IMPORT: /from ['"]@clerk\/backend\/webhooks['"]/,
  CLERK_NEXTJS_WEBHOOKS_IMPORT: /from ['"]@clerk\/nextjs\/webhooks['"]/,
  VERIFY_WEBHOOK_CALL: /await\s+verifyWebhook\s*\(/,
};

const PROMPT_NO_SVIX =
  "Does the solution avoid importing or referencing Svix directly?";
const PROMPT_VERIFY_WEBHOOK_CALLED_CORRECTLY =
  "Does the solution call verifyWebhook with the incoming request object?";
const PROMPT_HTTP_RESPONSES =
  "Does the handler return a 200 response after successful verification and a 400-level response when verification fails?";

export const SCORERS = {
  NO_SVIX: makeScorer(PROMPT_NO_SVIX),
  VERIFY_WEBHOOK_CALLED_CORRECTLY: makeScorer(
    PROMPT_VERIFY_WEBHOOK_CALLED_CORRECTLY
  ),
  HTTP_RESPONSES: makeScorer(PROMPT_HTTP_RESPONSES),
};
