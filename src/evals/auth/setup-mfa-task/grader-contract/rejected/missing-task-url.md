---
fail:
  - configures_setup_mfa_task
---

```tsx file="app/layout.tsx"
import { ClerkProvider } from '@clerk/nextjs'
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html>
        <body>{children}</body>
      </html>
    </ClerkProvider>
  )
}
```

```tsx file="app/session-tasks/setup-mfa/page.tsx"
import { TaskSetupMFA } from '@clerk/nextjs'
export default function Page() {
  return <TaskSetupMFA redirectUrlComplete="/dashboard" />
}
```
