# Add Clerk Authentication

Set up Clerk authentication by following the official quickstart for this project's framework.

## Step 1: Detect the framework

Read `package.json` (if it exists) and match against this table. If there is no `package.json`, check for `build.gradle.kts` (Android) or `Package.swift` (iOS).

| Dependency | Quickstart |
|------------|-----------|
| `next` | https://clerk.com/docs/nextjs/getting-started/quickstart.md |
| `@remix-run/react` | https://clerk.com/docs/remix/getting-started/quickstart.md |
| `astro` | https://clerk.com/docs/astro/getting-started/quickstart.md |
| `nuxt` | https://clerk.com/docs/nuxt/getting-started/quickstart.md |
| `react-router` | https://clerk.com/docs/react-router/getting-started/quickstart.md |
| `@tanstack/react-start` | https://clerk.com/docs/tanstack-react-start/getting-started/quickstart.md |
| `react` (no framework) | https://clerk.com/docs/react/getting-started/quickstart.md |
| `vue` | https://clerk.com/docs/vue/getting-started/quickstart.md |
| `express` | https://clerk.com/docs/expressjs/getting-started/quickstart.md |
| `fastify` | https://clerk.com/docs/fastify/getting-started/quickstart.md |
| `expo` | https://clerk.com/docs/expo/getting-started/quickstart.md |

Other: Chrome Extension, Android, iOS, Vanilla JS at https://clerk.com/docs/llms.txt

## Step 2: Fetch and follow the quickstart

Read the quickstart URL from the table above and follow every step:
1. Install the SDK package
2. Add the provider/middleware
3. Create sign-in/sign-up routes if needed
4. Test the integration

## Step 3: API Keys

Follow the quickstart's key setup exactly — wire publishableKey into the provider/config even if using Keyless mode. Keyless auto-populates the environment variable at dev time, but the code must still reference it.

## Step 4: If using shadcn/ui

If `components.json` exists in the project root:

```bash
npm install @clerk/ui
```

Apply the theme in your provider:
```tsx
import { shadcn } from '@clerk/ui/themes'
<ClerkProvider appearance={{ theme: shadcn }}>{children}</ClerkProvider>
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
