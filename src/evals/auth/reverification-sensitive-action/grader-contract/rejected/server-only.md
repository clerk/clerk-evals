---
fail:
  - export_button_file
  - imports_use_reverification
  - wraps_post_request
---

```ts file="app/api/account/export/route.ts"
import { auth, reverificationErrorResponse } from '@clerk/nextjs/server'
export async function POST() {
  const { has } = await auth()
  if (!has({ reverification: 'strict' })) return reverificationErrorResponse('strict')
  return Response.json({ ready: true })
}
```
