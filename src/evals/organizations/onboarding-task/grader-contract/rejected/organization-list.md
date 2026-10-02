---
fail:
  - imports_task_choose_organization
  - renders_task_choose_organization
  - redirects_to_dashboard
  - no_organization_list_substitute
---

```tsx file="app/layout.tsx"
import { ClerkProvider } from '@clerk/nextjs'
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider taskUrls={{ 'choose-organization': '/session-tasks/choose-organization' }}>
      <html>
        <body>{children}</body>
      </html>
    </ClerkProvider>
  )
}
```

```tsx file="app/session-tasks/choose-organization/page.tsx"
import { OrganizationList } from '@clerk/nextjs'
export default function Page() {
  return <OrganizationList />
}
```
