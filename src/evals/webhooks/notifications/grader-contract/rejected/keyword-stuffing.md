---
fail:
  - handles_email_created
  - logs_email_payload
  - handles_sms_created
  - warns_sms_payload
  - mentions_event_id
  - http_responses
---

The route should import { verifyWebhook } from '@clerk/backend/webhooks' and call await verifyWebhook(request).
Set CLERK_WEBHOOK_SIGNING_SECRET. Handle email.created with console.log, JSON.stringify, and eventId.
Handle sms.created with console.warn and JSON.stringify. Return status: 200 or status: 400 as needed.
