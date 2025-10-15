# Task

Wire up a Next.js webhook Route Handler at `app/api/webhooks/route.ts` so you can take over delivery of Clerk emails and SMS messages.

## Requirements

- Import `verifyWebhook` from `@clerk/backend/webhooks` and verify with `CLERK_WEBHOOK_SIGNING_SECRET`.
- When the event type is `email.created`, log a JSON stringified version of the payload (include the event ID in the message) so you can hand it off to your ESP.
- When the event type is `sms.created`, log a JSON stringified version of the payload with `console.warn` so you can inspect the SMS data.
- Respond with `200` when verification succeeds and `400` if it fails.
- Do not require Clerk auth for this route.
