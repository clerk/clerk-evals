import { all, any, contains, containsAny, defineGraders, judge, matches } from '@/src/graders'

export const graders = defineGraders({
  imports_experimental_checkout: contains('@clerk/nextjs/experimental'),
  uses_checkout_provider: contains('CheckoutProvider'),
  uses_use_checkout: contains('useCheckout'),
  uses_payment_element: all(contains('PaymentElementProvider'), contains('PaymentElement')),
  uses_use_payment_element: contains('usePaymentElement'),
  starts_checkout: any(matches(/checkout\.start\s*\(/), matches(/\.start\(\)/)),
  finalizes_checkout: all(contains('finalize'), contains('redirectUrl')),
  shows_plan_summary: containsAny(['checkout.plan', 'totals']),
  confirm_after_submit: judge(
    'Does the solution submit the payment element, use its data to call checkout.confirm, and then call checkout.finalize to finish the flow?',
  ),
})
