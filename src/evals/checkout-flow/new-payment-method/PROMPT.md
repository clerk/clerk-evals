# Task

Compose a Next.js App Router checkout page at `app/checkout/page.tsx` that mirrors the "add a new payment method during checkout" flow from Clerk's billing docs.

## Requirements

- Mark the file as a client component (`'use client'`).
- Wrap the UI in a `CheckoutProvider` from `@clerk/nextjs/experimental` configured with a `planId` and `planPeriod`.
- Gate the custom UI with `<ClerkLoaded>` and `<SignedIn>`.
- Use `useCheckout()` to manage state. Show an initialization button that calls `checkout.start()` while `checkout.status === 'needs_initialization'`.
- Render a `PaymentElement` inside `PaymentElementProvider` and manage it with `usePaymentElement()`.
- On submit: call `submit()` from `usePaymentElement()`, feed the result into `checkout.confirm(...)`, then finish with `checkout.finalize({ redirectUrl: '/dashboard' })`. Include basic loading/error guards.
- Surface a simple order summary using `checkout.plan` and `checkout.totals`.
