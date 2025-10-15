# Task

Implement a Next.js webhook Route Handler at `app/api/webhooks/route.ts` that reacts to top-level Clerk subscription events.

## Requirements

- Import `verifyWebhook` from `@clerk/backend/webhooks` and validate webhook signatures using the `CLERK_WEBHOOK_SIGNING_SECRET` environment variable.
- When the webhook type is `subscription.created`, log the subscription ID and payer ID so you can persist them in your billing system.
- When the webhook type is `subscription.pastDue`, log an error that includes the subscription ID and the current status from the payload.
- Always return a `200` response after the webhook is verified. If verification fails, return a `400` response.
- Leave the route unauthenticated so Clerk can deliver webhooks.
