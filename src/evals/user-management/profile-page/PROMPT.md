# Task

Create a Clerk-enabled Next.js profile page that combines server-side user fetching with live client updates.

## Requirements

1. Create `app/profile/page.tsx` — A server component that uses `currentUser()` from `@clerk/nextjs/server` to fetch user data
2. Create `app/profile/user-client.tsx` — A `'use client'` component that uses `useUser()` for live updates and renders `<UserButton />` with `afterSignOutUrl="/"`
3. Create `app/api/profile/route.ts` — An API route that:
   - Returns 401 JSON when no user is signed in
   - Returns 200 JSON with `id`, `firstName`, and `lastName` when authenticated
4. Create `middleware.ts` using `clerkMiddleware()`
5. Include `package.json` with `@clerk/nextjs` >= 6.0.0
6. Include `.env.local` with `CLERK_SECRET_KEY` and `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
