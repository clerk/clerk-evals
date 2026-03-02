import { contains, containsAny, defineGraders, judge } from '@/src/graders'

export const graders = defineGraders({
  // Provider setup
  has_openfort_provider: contains('OpenfortProvider'),
  has_wagmi_provider: contains('WagmiProvider'),
  configures_base_sepolia: containsAny(['baseSepolia', '84532']),
  has_publishable_key: containsAny(['publishableKey', 'PUBLISHABLE_KEY']),

  // Gas sponsorship policy
  uses_pay_for_user: containsAny(['pay_for_user', 'payForUser']),
  creates_policy: containsAny(['policies.create', '/v1/policies', 'createPolicy']),
  references_sponsor_schema: containsAny(['sponsorSchema', 'sponsor_schema']),

  // Transaction intent with sponsorship
  creates_transaction_intent: containsAny([
    'transactionIntents.create',
    'transaction_intents',
    'transactionIntent',
  ]),
  references_policy_in_transaction: containsAny(['policy']),

  // Contract registration and policy rules
  registers_contract: containsAny(['contracts.create', '/v1/contracts']),
  creates_policy_rule: containsAny(['policyRules.create', 'policy_rules', 'policyRule']),
  references_contract_functions: containsAny(['contract_functions', 'functionName']),

  // Conceptual understanding
  explains_sponsorship_flow: judge(
    'Does the code demonstrate the full gas sponsorship flow: creating a policy with pay_for_user strategy, then using that policy when creating a transaction intent so the user pays no gas?',
  ),
  targets_base_sepolia: judge(
    'Does the code specifically target the Base Sepolia testnet (chain ID 84532) for the sponsored transactions?',
  ),
})
