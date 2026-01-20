# Claude Code Agent Transcript

## Execution Info
- **Duration**: 13.14s
- **Exit Code**: 0
- **Success**: true

## Prompt
```markdown
YOU MUST output all files as fenced code blocks, like so

```lang file="path/to/file.ts"
// file content
```

Do not ask clarifying questions. Complete the task with the information provided.

---

# Task

Implement a Next.js webhook Route Handler at `app/api/webhooks/route.ts` that reacts to top-level Clerk subscription events.

## Requirements

- Import `verifyWebhook` from `@clerk/backend/webhooks` and validate webhook signatures using the `CLERK_WEBHOOK_SIGNING_SECRET` environment variable.
- When the webhook type is `subscription.created`, log the subscription ID and payer ID so you can persist them in your billing system.
- When the webhook type is `subscription.pastDue`, log an error that includes the subscription ID and the current status from the payload.
- Always return a `200` response after the webhook is verified. If verification fails, return a `400` response.
- Leave the route unauthenticated so Clerk can deliver webhooks.
```

## Output
```
I'll implement a Next.js webhook Route Handler that handles Clerk subscription events with proper signature verification.

```typescript file="app/api/webhooks/route.ts"
import { verifyWebhook } from '@clerk/backend/webhooks';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  // Get the webhook signature from headers
  const headerPayload = await headers();
  const svix_id = headerPayload.get('svix-id');
  const svix_timestamp = headerPayload.get('svix-timestamp');
  const svix_signature = headerPayload.get('svix-signature');

  // If there are no headers, return 400
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return NextResponse.json(
      { error: 'Missing webhook headers' },
      { status: 400 }
    );
  }

  // Get the body as text
  const body = await req.text();

  // Verify the webhook signature
  try {
    const payload = verifyWebhook(body, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    }, process.env.CLERK_WEBHOOK_SIGNING_SECRET!);

    // Handle different webhook types
    const { type, data } = payload as {
      type: string;
      data: {
        id: string;
        payer_id?: string;
        status?: string;
      };
    };

    switch (type) {
      case 'subscription.created':
        console.log('Subscription created:', {
          subscriptionId: data.id,
          payerId: data.payer_id,
        });
        break;

      case 'subscription.pastDue':
        console.error('Subscription past due:', {
          subscriptionId: data.id,
          status: data.status,
        });
        break;
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error('Webhook verification failed:', err);
    return NextResponse.json(
      { error: 'Webhook verification failed' },
      { status: 400 }
    );
  }
}
```

This implementation:

1. **Verifies webhook signatures** using `verifyWebhook` from `@clerk/backend/webhooks` with the `CLERK_WEBHOOK_SIGNING_SECRET` environment variable
2. **Handles `subscription.created`** by logging the subscription ID and payer ID for persistence in your billing system
3. **Handles `subscription.pastDue`** by logging an error with the subscription ID and current status
4. **Returns 200** after successful verification and processing
5. **Returns 400** if verification fails or required headers are missing
6. **Remains unauthenticated** (no auth middleware) so Clerk can deliver webhooks directly

The route extracts the Svix headers (`svix-id`, `svix-timestamp`, `svix-signature`) that Clerk uses for webhook signing, verifies the signature, and then processes the webhook based on its type.

```

## Grader Results
**Score: 58.3%** (7/12)

| Grader | Result |
|--------|--------|
| imports_verify_webhook | PASS |
| calls_verify_webhook | FAIL |
| mentions_env_secret | PASS |
| handles_subscription_created | PASS |
| logs_payer_id | PASS |
| handles_subscription_past_due | PASS |
| logs_subscription_id | FAIL |
| errors_on_past_due | PASS |
| references_status_field | FAIL |
| verify_webhook_called_correctly | FAIL |
| http_responses | PASS |
| no_svix | FAIL |
