import type { Graders } from "@/src/interfaces";
import { makeScorer } from "@/src/scorers/llm";

const hasUseClient = (actual: string) =>
  actual.includes("'use client'") || actual.includes('"use client"');

export const graders = {
  declares_use_client: async (actual) => hasUseClient(actual),
  imports_experimental_checkout: async (actual) =>
    actual.includes("@clerk/nextjs/experimental"),
  uses_checkout_provider: async (actual) =>
    actual.includes("CheckoutProvider"),
  uses_use_checkout: async (actual) => actual.includes("useCheckout"),
  starts_checkout: async (actual) => /checkout\.start\s*\(/.test(actual),
  fetches_payment_methods: async (actual) => actual.includes("usePaymentMethods"),
  selects_payment_method: async (actual) =>
    actual.includes("paymentMethodId") || actual.includes("paymentSourceId"),
  confirms_with_payment_source: async (actual) =>
    actual.includes("confirm({") && actual.includes("paymentSourceId"),
  finalizes_checkout: async (actual) =>
    actual.includes("finalize") && actual.includes("redirectUrl"),
  handles_loading_or_errors: async (actual) =>
    actual.includes("isLoading") || actual.includes("error"),
  
  confirm_flow_llm: makeScorer(
    "Does the solution let the user pick an existing payment method, call checkout.confirm with that selection, and then call checkout.finalize with a redirect?"
  ),
} satisfies Graders;
