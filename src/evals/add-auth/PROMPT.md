# Add Clerk Authentication

Set up Clerk authentication by following the official quickstart for this project's framework.

## Step 1: Detect the framework

Read `package.json` (if it exists) and match against this table. If there is no `package.json`, check for `build.gradle.kts` (Android) or `Package.swift` (iOS).

| Dependency              | Quickstart                                                                |
| ----------------------- | ------------------------------------------------------------------------- |
| `next`                  | https://clerk.com/docs/nextjs/getting-started/quickstart.md               |
| `@remix-run/react`      | https://clerk.com/docs/remix/getting-started/quickstart.md                |
| `astro`                 | https://clerk.com/docs/astro/getting-started/quickstart.md                |
| `nuxt`                  | https://clerk.com/docs/nuxt/getting-started/quickstart.md                 |
| `react-router`          | https://clerk.com/docs/react-router/getting-started/quickstart.md         |
| `@tanstack/react-start` | https://clerk.com/docs/tanstack-react-start/getting-started/quickstart.md |
| `react` (no framework)  | https://clerk.com/docs/react/getting-started/quickstart.md                |
| `vue`                   | https://clerk.com/docs/vue/getting-started/quickstart.md                  |
| `express`               | https://clerk.com/docs/expressjs/getting-started/quickstart.md            |
| `fastify`               | https://clerk.com/docs/fastify/getting-started/quickstart.md              |
| `expo`                  | https://clerk.com/docs/expo/getting-started/quickstart.md                 |

Other: Chrome Extension, Android, iOS, Vanilla JS at https://clerk.com/docs/llms.txt

## Step 2: Set up with the Clerk CLI

For supported web projects, start with the Clerk CLI:

```bash
npx -y clerk@latest init
```

When the user is signed out, `clerk init` provisions a claimable accountless application, writes its development keys to the project's environment file, and configures the integration. Do not ask the user to create an account, obtain keys, or add environment variables first. The user can sign in later to claim the application. For other platforms, follow the quickstart's key setup (Step 3).

## Step 3: Fall back to the quickstart when init is incomplete

If `init` reports the framework unsupported or leaves setup incomplete, read the quickstart URL from the table above and follow every step it lists that `init` did not already complete:

1. Install the SDK package
2. Add the provider/middleware
3. Create sign-in/sign-up routes if needed
4. Test the integration

## Step 4: Add visible auth controls

The app needs sign-in, sign-up, and signed-in user controls (for example `<SignInButton>`, `<SignUpButton>`, and `<UserButton>` inside `<SignedOut>`/`<SignedIn>`), worked into the existing layout or navigation. `clerk init` does not add these to an existing project — create them per the quickstart if they are missing.

## Step 5: Verify the integration

After setup completes, read the auth files it created or modified and show their contents — the middleware or proxy file, the provider wiring (for example `app/layout.tsx`), and any auth UI. If anything is missing, finish it per the quickstart before moving on.

## Step 6: If using shadcn/ui

If `components.json` exists in the project root:

```bash
npm install @clerk/ui
```

Apply the theme in your provider:

```tsx
import { shadcn } from '@clerk/ui/themes'
;<ClerkProvider appearance={{ theme: shadcn }}>{children}</ClerkProvider>
```

Add to global CSS:

```css
@import '@clerk/ui/themes/shadcn.css';
```

## Critical rules

- Next.js 15+: `auth()` is async. Always `await auth()`
- `ClerkProvider` goes inside `<body>`, not wrapping `<html>`
- Never expose `CLERK_SECRET_KEY` in client code
- Use `@clerk/nextjs`, not `@clerk/clerk-react`

Full documentation: https://clerk.com/docs/llms.txt
