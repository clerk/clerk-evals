# Task

Set up a Next.js Route Handler at `app/api/webhooks/route.ts` that keeps user records in sync with Clerk webhooks.

## Requirements

- Use Clerk's `verifyWebhook` from `@clerk/backend/webhooks` and read the signing secret from `CLERK_WEBHOOK_SIGNING_SECRET`.
- When the event type is `user.updated`, log a structured message that includes the user's ID and primary email address.
- When the event type is `user.deleted`, log a warning that includes the user's ID so downstream systems can remove the user.
- Return `200` after successful verification (even if the event isn't one you act on) and return `400` if verification fails.
- Ensure the handler remains accessible without Clerk auth so webhooks can reach it.
