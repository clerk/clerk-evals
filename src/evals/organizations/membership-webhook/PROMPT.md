# Task

Create a Next.js Route Handler that processes Clerk webhooks for organization membership lifecycle events. The handler should live at `app/api/webhooks/route.ts`.

## Requirements

- Use Clerk's `verifyWebhook` helper from `@clerk/backend/webhooks` and rely on the `CLERK_WEBHOOK_SIGNING_SECRET` environment variable when verifying the request.
- When the webhook type is `organizationMembership.created`, log the membership ID and the organization ID from the payload.
- When the webhook type is `organizationMembership.deleted`, log the membership ID and the member's `publicUserData?.identifier`.
- Return a `200` response once verification succeeds (regardless of whether the event is handled) and return `400` if signature verification fails.
- Keep the handler public-friendly (no Clerk auth required) so the webhook can be delivered.
