# Task

Create a Next.js app that implements a webhook endpoint to receive Clerk user events.

## Requirements

- Use Clerk's `verifyWebhook` utility from `@clerk/backend/webhooks` to verify the webhook signature
- Handle the `user.created` event
- Log the user's ID and email address to the console
