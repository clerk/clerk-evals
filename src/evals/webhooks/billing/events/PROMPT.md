# Task

Build a Next.js webhook Route Handler at `app/api/webhooks/route.ts` that reacts to Clerk billing events.

## Requirements

- Use Clerk's `verifyWebhook` helper from `@clerk/backend/webhooks` and lean on the `CLERK_WEBHOOK_SIGNING_SECRET` environment variable for verification.
- When a `subscriptionItem.freeTrialEnding` webhook arrives, log the subscription item ID and its status with `console.warn`.
- When the webhook type is `paymentAttempt.updated`, examine `evt.data.status`. Log successful attempts with `console.log`, but if the status is `"failed"` log with `console.error` and include the payment attempt's `type`.
- Always respond with a `200` result after verification succeeds. Return a `400` response if signature verification fails.
