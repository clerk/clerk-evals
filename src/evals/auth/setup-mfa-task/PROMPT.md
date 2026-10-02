# Task

Add Clerk's required MFA setup task to a Next.js App Router project that uses Clerk Core 3.

## Requirements

1. Configure `ClerkProvider` in `app/layout.tsx` with a `taskUrls` entry for `'setup-mfa'`.
2. Map the task to `/session-tasks/setup-mfa`.
3. Create `app/session-tasks/setup-mfa/page.tsx`.
4. Import and render `TaskSetupMFA` from `@clerk/nextjs`.
5. Set `redirectUrlComplete` to `/dashboard`.

Use Clerk's task component. Do not build a separate custom MFA enrollment flow.
