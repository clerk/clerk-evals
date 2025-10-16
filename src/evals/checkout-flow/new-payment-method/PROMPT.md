# Task

Compose a Next.js App Router checkout page at `app/checkout/page.tsx` that mirrors the "add a new payment method during checkout" flow from Clerk's billing docs. Treat the page as a client component, wrap the UI in the experimental `CheckoutProvider` configured with the appropriate plan metadata, and gate the custom interface behind `<ClerkLoaded>` and `<SignedIn>`.

The flow should use `useCheckout()` to drive state. When the checkout is uninitialized, present a button that calls `checkout.start()`. Once active, render a payment form powered by `PaymentElementProvider`, `PaymentElement`, and `usePaymentElement()`. Submitting the form should invoke `submit()` to collect payment details, pass the result into `checkout.confirm(...)`, and then call `checkout.finalize({ redirectUrl: '/dashboard' })`. Include basic loading and error handling, and surface an order summary using `checkout.plan` and `checkout.totals`.
