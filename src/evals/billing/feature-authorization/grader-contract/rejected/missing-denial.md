---
fail:
  - denies_missing_feature_with_403
---

```ts file="app/api/reports/premium/route.ts"
import { auth } from '@clerk/nextjs/server'
export async function GET() {
  const { has } = await auth()
  const allowed = has({ feature: 'premium_reports' })
  return Response.json({ report: allowed ? 'premium data' : null }, { status: 200 })
}
```
