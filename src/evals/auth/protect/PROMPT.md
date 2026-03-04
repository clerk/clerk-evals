# Task

Build a Clerk-enabled Next.js App Router admin area that enforces both authentication and authorization for an organization settings page.

## Requirements

1. Create `app/admin/page.tsx` — An admin page protected by the `org:team_settings:manage` permission using `auth.protect()`
2. Create `app/api/admin/route.ts` — A protected API route that:
   - Returns 401 when no user is signed in (use `redirectToSignIn()`)
   - Returns 403 when the user lacks the required permission (use `has()` with `org:team_settings:manage`)
   - Returns 200 with the `userId` when authorized
3. Create `middleware.ts` using `clerkMiddleware()` from `@clerk/nextjs/server`
4. Include `package.json` with `@clerk/nextjs` >= 6.0.0
5. Include `.env.local` with `CLERK_SECRET_KEY` and `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
