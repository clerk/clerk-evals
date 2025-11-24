import { contains, containsAny, defineGraders, judge, matches } from '@/src/graders'

const hasUseClient = containsAny(["'use client'", '"use client"'], {
  caseSensitive: true,
})

export const graders = defineGraders({
  declares_use_client: hasUseClient,
  imports_experimental_checkout: contains('@clerk/nextjs/experimental'),
  uses_checkout_provider: contains('CheckoutProvider'),
  uses_use_checkout: contains('useCheckout'),
  starts_checkout: matches(/checkout\.start\s*\(/),
  fetches_payment_methods: contains('usePaymentMethods'),
  selects_payment_method: containsAny(['paymentMethodId', 'paymentSourceId']),
  confirms_with_payment_source: async (actual) =>
    (await contains('confirm({')(actual)) && (await contains('paymentSourceId')(actual)),
  finalizes_checkout: async (actual) =>
    (await contains('finalize')(actual)) && (await contains('redirectUrl')(actual)),
  handles_loading_or_errors: containsAny(['isLoading', 'error']),
  confirm_flow_llm: judge(
    'Does the solution let the user pick an existing payment method, call checkout.confirm with that selection, and then call checkout.finalize with a redirect?',
  ),
})
