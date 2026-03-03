# Add Clerk to Next.js App Router

Install `@clerk/nextjs@latest`. Create `middleware.ts` with `clerkMiddleware()` from `@clerk/nextjs/server` (in `src/` if it exists, otherwise project root). Add `<ClerkProvider>` inside `<body>` in `app/layout.tsx`. Use `<Show>`, `<UserButton>`, `<SignInButton>`, `<SignUpButton>` from `@clerk/nextjs`.

Set environment variables `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` from the Clerk Dashboard.

Latest docs: https://clerk.com/docs/quickstarts/nextjs

## Install

```bash
npm install @clerk/nextjs
```

## middleware.ts

```typescript
import { clerkMiddleware } from '@clerk/nextjs/server'

export default clerkMiddleware()

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
```

## app/layout.tsx

```typescript
import { ClerkProvider, SignInButton, SignUpButton, Show, UserButton } from "@clerk/nextjs";
import "./globals.css";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ClerkProvider>
          <header>
            <Show when="signed-out">
              <SignInButton />
              <SignUpButton />
            </Show>
            <Show when="signed-in">
              <UserButton />
            </Show>
          </header>
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
```

## Rules

ALWAYS:

- Use `clerkMiddleware()` from `@clerk/nextjs/server` in `middleware.ts`
- Add `<ClerkProvider>` inside `<body>` in `app/layout.tsx`
- Import from `@clerk/nextjs` or `@clerk/nextjs/server`
- Use App Router (app/page.tsx, app/layout.tsx)
- async/await with auth() from `@clerk/nextjs/server`
- Use existing package manager
- Set environment_variables for Clerk keys

NEVER:

- Reference `_app.tsx` or pages router
- Use `authMiddleware()` (replaced by `clerkMiddleware()`)
- Use old env var patterns
- Import deprecated APIs (withAuth, old currentUser)
- Use deprecated `<SignedIn>`, `<SignedOut>` (replaced by `<Show>`)

## Deprecated (DO NOT use)

```typescript
import { authMiddleware } from '@clerk/nextjs' // WRONG
function MyApp({ Component, pageProps }) {} // pages router, WRONG
pages / signin.js // WRONG
<SignedIn> // WRONG, use <Show when="signed-in">
<SignedOut> // WRONG, use <Show when="signed-out">
```

## Verify Before Responding

1. Is `clerkMiddleware()` used in `middleware.ts`?
2. Is `ClerkProvider` inside `<body>` in `app/layout.tsx`?
3. Are imports only from `@clerk/nextjs` or `@clerk/nextjs/server`?
4. Is it using App Router, not `_app.tsx` or `pages/`?
5. Is it using `<Show>` instead of `<SignedIn>`/`<SignedOut>`?

If any fails, revise.
