```ts file="app/api/webhooks/route.ts"
import { verifyWebhook } from '@clerk/backend/webhooks'

export async function POST(request: Request) {
  try {
    const evt = await verifyWebhook(request)

    if (evt.type === 'email.created') {
      console.log(JSON.stringify({ eventId: evt.id, data: evt.data }))
    }

    if (evt.type === 'sms.created') {
      console.warn(JSON.stringify(evt.data))
    }

    return Response.json({ received: true }, { status: 200 })
  } catch {
    return Response.json({ error: 'Invalid webhook' }, { status: 400 })
  }
}
```

```dotenv file=".env.local"
CLERK_WEBHOOK_SIGNING_SECRET=whsec_example
```
