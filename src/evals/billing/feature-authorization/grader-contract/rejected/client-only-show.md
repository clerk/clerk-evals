---
fail:
  - premium_report_route_file
  - imports_server_auth
  - reads_has_from_auth
  - checks_premium_reports_feature
  - denies_missing_feature_with_403
  - returns_authorized_report_with_200
---

```tsx file="app/reports/page.tsx"
import { Show } from '@clerk/nextjs'
export default function ReportsPage() {
  return <Show when={{ feature: 'premium_reports' }}>premium data</Show>
}
```
