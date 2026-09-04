```ts file="app/api/reports/premium/route.ts"
import { auth } from '@clerk/nextjs/server'

export async function GET() {
  const { has } = await auth()
  if (!has({ feature: 'premium_reports' })) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }
  return Response.json({ report: 'premium data' }, { status: 200 })
}
```
