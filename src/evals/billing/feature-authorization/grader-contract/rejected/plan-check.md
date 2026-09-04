---
fail:
  - checks_premium_reports_feature
  - denies_missing_feature_with_403
---

```ts file="app/api/reports/premium/route.ts"
import { auth } from '@clerk/nextjs/server'
export async function GET() {
  const { has } = await auth()
  if (!has({ plan: 'pro' })) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }
  return Response.json({ report: 'premium data' }, { status: 200 })
}
```
