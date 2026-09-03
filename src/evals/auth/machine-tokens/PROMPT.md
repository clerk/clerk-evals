# Task

Add a machine-authenticated endpoint to a Next.js App Router project that uses Clerk Core 3.

## Requirements

1. Create `app/api/machine-data/route.ts` with a `GET` handler.
2. Import `auth` from `@clerk/nextjs/server`.
3. Call `auth()` with `acceptsToken` set to an array that accepts only `'api_key'` and `'m2m_token'`.
4. Return a JSON response with status 401 when `isAuthenticated` is false.
5. Return a JSON success response with status 200 when the machine token is valid.
6. Create `proxy.ts` and export `clerkMiddleware()` from `@clerk/nextjs/server` as the default export.
7. Do not read or verify the `Authorization` header manually. Let Clerk verify the token.

Do not accept session tokens, OAuth tokens, or every token type.
