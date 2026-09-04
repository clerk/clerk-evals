---
fail:
  - requires_strict_reverification
  - returns_clerk_reverification_response
---

```ts file="app/api/account/export/route.ts"
import { auth, reverificationErrorResponse } from '@clerk/nextjs/server'
export async function POST() {
  const { has } = await auth()
  if (!has({ reverification: 'lax' })) return reverificationErrorResponse('lax')
  return Response.json({ ready: true })
}
```

```tsx file="app/account/export-button.tsx"
'use client'
import { useReverification } from '@clerk/nextjs'
export function ExportButton() {
  const exportAccount = useReverification(() => fetch('/api/account/export', { method: 'POST' }))
  return <button onClick={() => exportAccount()}>Export</button>
}
```
