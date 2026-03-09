import { contains, containsAny, defineGraders, judge } from '@/src/graders'

export const graders = defineGraders({
  imports_openfort_node: containsAny(['@openfort/openfort-node', 'openfort-node']),
  initializes_sdk: containsAny(['new Openfort', 'Openfort(']),
  loads_api_key_from_env: contains('process.env.OPENFORT_SECRET_KEY'),
  loads_wallet_secret_from_env: contains('process.env.OPENFORT_WALLET_SECRET'),
  loads_policy_id_from_env: contains('process.env.OPENFORT_POLICY_ID'),
  creates_fee_sponsorship: containsAny(['feeSponsorship.create', 'fee_sponsorship']),
  uses_pay_for_user: contains('pay_for_user'),
  references_policy_id: containsAny(['policyId', 'OPENFORT_POLICY_ID']),
  creates_contract: contains('contracts.create'),
  creates_transaction_intent: contains('transactionIntents.create'),
  has_interactions: containsAny(['interactions', 'functionName', 'functionArgs']),
  correct_sponsorship_flow: judge(
    'Does the code demonstrate the correct Openfort fee sponsorship flow: (1) load the policy ID from an environment variable, (2) create a fee sponsorship linked to the policy with pay_for_user strategy, (3) register a contract, and (4) create a transaction intent referencing the sponsorship?',
  ),
})
