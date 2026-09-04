# Task

Require signed-in users to choose an organization in a Next.js App Router project that uses Clerk Core 3.

## Requirements

1. Configure `ClerkProvider` in `app/layout.tsx` with a `taskUrls` entry for `'choose-organization'`.
2. Map the task to `/session-tasks/choose-organization`.
3. Create `app/session-tasks/choose-organization/page.tsx`.
4. Import and render `TaskChooseOrganization` from `@clerk/nextjs`.
5. Set `redirectUrlComplete` to `/dashboard`.

Use Clerk's session task. Do not replace it with a normal organization list page.
