---
fail:
  - configures_choose_organization_task
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

```tsx file="app/session-tasks/choose-organization/page.tsx"
import { TaskChooseOrganization } from '@clerk/nextjs'
export default function Page() {
  return <TaskChooseOrganization redirectUrlComplete="/dashboard" />
}
```
