```tsx file="app/layout.tsx"
import { ClerkProvider } from '@clerk/nextjs'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider taskUrls={{ 'setup-mfa': '/session-tasks/setup-mfa' }}>
      <html>
        <body>{children}</body>
      </html>
    </ClerkProvider>
  )
}
```

```tsx file="app/session-tasks/setup-mfa/page.tsx"
import { TaskSetupMFA } from '@clerk/nextjs'

export default function SetupMFAPage() {
  return <TaskSetupMFA redirectUrlComplete="/dashboard" />
}
```
