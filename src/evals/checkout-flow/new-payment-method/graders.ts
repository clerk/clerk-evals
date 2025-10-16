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
  uses_payment_element: async (actual) =>
    actual.includes("PaymentElementProvider") && actual.includes("PaymentElement"),
  uses_use_payment_element: async (actual) => actual.includes("usePaymentElement"),
  starts_checkout: async (actual) =>
    /checkout\.start\s*\(/.test(actual) || /.start\(\)/.test(actual),
  finalizes_checkout: async (actual) =>
    actual.includes("finalize") && actual.includes("redirectUrl"),
  shows_plan_summary: async (actual) =>
    actual.includes("checkout.plan") || actual.includes("totals"),

  confirm_after_submit: makeScorer(
    "Does the solution submit the payment element, use its data to call checkout.confirm, and then call checkout.finalize to finish the flow?"
  ),
} satisfies Graders;
