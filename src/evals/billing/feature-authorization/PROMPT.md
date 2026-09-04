# Task

Protect a paid organization feature in a Next.js App Router project that uses Clerk Billing.

## Requirements

1. Create `app/api/reports/premium/route.ts` with a `GET` handler.
2. Import `auth` from `@clerk/nextjs/server`.
3. Read `has` from `await auth()`.
4. Check `has({ feature: 'premium_reports' })` on the server.
5. Return a 403 JSON response when the active organization does not have the feature.
6. Return the premium report with a 200 JSON response when access is allowed.

Do not use only a client-side `Show` component. Client-side visibility is not a data authorization boundary.
