---
fail:
  - no_manual_authorization_header
---

```ts file="app/api/machine-data/route.ts"
import { auth } from '@clerk/nextjs/server'

export async function GET(request: Request) {
  request.headers.get('authorization')
  const { isAuthenticated } = await auth({
    acceptsToken: ['api_key', 'm2m_token'],
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
