---
fail:
  - imports_task_setup_mfa
  - renders_task_setup_mfa
  - redirects_to_dashboard
---

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
export default function Page() {
  return (
    <form>
      <input name="totp" />
    </form>
  )
}
```
