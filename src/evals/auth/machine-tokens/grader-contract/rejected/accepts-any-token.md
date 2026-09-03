---
fail:
  - accepts_api_key_and_m2m_only
---

```ts file="app/api/machine-data/route.ts"
import { auth } from '@clerk/nextjs/server'

export async function GET() {
  const { isAuthenticated } = await auth({
    acceptsToken: 'any',
  })

  if (!isAuthenticated) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return Response.json({ authenticated: true }, { status: 200 })
}
```

```ts file="proxy.ts"
import { clerkMiddleware } from '@clerk/nextjs/server'

export default clerkMiddleware()
```
