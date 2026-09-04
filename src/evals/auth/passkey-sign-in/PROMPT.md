# Task

Add a custom passkey sign-in button to a Next.js App Router project that uses Clerk Core 3.

## Requirements

1. Create `app/sign-in/passkey-button.tsx` as a Client Component.
2. Import and call `useSignIn` from `@clerk/nextjs`.
3. Start sign-in with `signIn.passkey({ flow: 'discoverable' })`.
4. Check for the `complete` status.
5. Call `signIn.finalize(...)` with a navigation function after sign-in completes.
6. Do not call WebAuthn browser APIs directly.
7. Do not use the deprecated `authenticateWithPasskey` API.
