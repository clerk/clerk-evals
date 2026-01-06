import { contains, containsAny, defineGraders, judge, matches } from '@/src/graders'

export const graders = defineGraders({
  imports_experimental_checkout: contains('@clerk/nextjs/experimental'),
  uses_checkout_provider: contains('CheckoutProvider'),
  uses_use_checkout: contains('useCheckout'),
  uses_payment_element: async (actual) =>
    (await contains('PaymentElementProvider')(actual)) &&
    (await contains('PaymentElement')(actual)),
  uses_use_payment_element: contains('usePaymentElement'),
  starts_checkout: async (actual) =>
    (await matches(/checkout\.start\s*\(/)(actual)) || (await matches(/\.start\(\)/)(actual)),
  finalizes_checkout: async (actual) =>
    (await contains('finalize')(actual)) && (await contains('redirectUrl')(actual)),
  shows_plan_summary: containsAny(['checkout.plan', 'totals']),
  confirm_after_submit: judge(
    'Does the solution submit the payment element, use its data to call checkout.confirm, and then call checkout.finalize to finish the flow?',
  ),
})
