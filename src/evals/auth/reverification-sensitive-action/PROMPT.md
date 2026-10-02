# Task

Protect a sensitive Next.js App Router action with Clerk reverification.

## Requirements

1. Create `app/api/account/export/route.ts` with a `POST` handler.
2. Import `auth` and `reverificationErrorResponse` from `@clerk/nextjs/server`.
3. Read `has` from `await auth()`.
4. Require `has({ reverification: 'strict' })`.
5. Return `reverificationErrorResponse('strict')` when the check fails.
6. Create `app/account/export-button.tsx` as a Client Component.
7. Import `useReverification` from `@clerk/nextjs` and use it to wrap the POST request.

Do not replace Clerk's reverification response with a manual 403 response.
