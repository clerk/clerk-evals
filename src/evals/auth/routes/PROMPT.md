Create a Next.js 15 App Router app with Clerk authentication and the following protected API routes:

1. **GET /api/hello** - Use should be a protected route.
2. **GET /api/user** - Use should return the current user, or 404.

Include `app/layout.tsx`, `middleware.ts` with `clerkMiddleware()`, `package.json` with the current `@clerk/nextjs` package, and the required Clerk environment variable names. Do not include real secret values.
