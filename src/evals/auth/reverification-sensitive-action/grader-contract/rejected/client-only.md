---
fail:
  - export_route_file
  - imports_server_reverification
  - reads_has_from_auth
  - requires_strict_reverification
  - returns_clerk_reverification_response
---

```tsx file="app/account/export-button.tsx"
'use client'
import { useReverification } from '@clerk/nextjs'
export function ExportButton() {
  const exportAccount = useReverification(() => fetch('/api/account/export', { method: 'POST' }))
  return <button onClick={() => exportAccount()}>Export</button>
}
```
