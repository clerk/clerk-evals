# Task

Create a Next.js App Router checkout page at `app/checkout/page.tsx` that follows Clerk's "checkout with an existing payment method" guidance.

## Requirements

- Treat the page as a client component.
- Mount the experience inside `CheckoutProvider` from `@clerk/nextjs/experimental` with `planId`/`planPeriod` props.
- Wrap the custom UI with `<ClerkLoaded>` and `<SignedIn>`.
- Use `useCheckout()` for flow control and display an initialization button that invokes `checkout.start()` when `checkout.status` requires it.
- Fetch saved payment methods with `usePaymentMethods({ for: 'user' })`, present a selectable list, and store the chosen method ID.
- Call `checkout.confirm({ paymentSourceId })` using the selected (or default) method, then complete with `checkout.finalize({ redirectUrl: '/dashboard' })`.
- Include minimal loading/error handling along the way.
