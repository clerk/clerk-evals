import { contains, containsAny, defineGraders, judge } from '@/src/graders'

export const graders = defineGraders({
  // Provider setup
  has_openfort_provider: contains('OpenfortProvider'),
  has_wagmi_provider: contains('WagmiProvider'),
  configures_base_sepolia: containsAny(['baseSepolia', '84532']),
  has_publishable_key: containsAny(['publishableKey', 'PUBLISHABLE_KEY']),

  // USDC contract registration
  references_usdc_address: contains('0x036CbD53842c5426634e7929541eC2318f3dCF7e'),
  registers_token_contract: containsAny(['contracts.create', '/v1/contracts']),

  // ERC-20 gas payment policy
  uses_erc20_strategy: containsAny([
    'fixed_rate',
    'charge_custom_tokens',
    'fixedRate',
    'chargeCustomTokens',
  ]),
  references_token_contract_in_policy: containsAny(['tokenContract', 'token_contract']),
  references_token_amount: containsAny(['tokenContractAmount', 'token_contract_amount']),
  references_sponsor_schema: containsAny(['sponsorSchema', 'sponsor_schema']),

  // Transaction intent
  creates_transaction_intent: containsAny([
    'transactionIntents.create',
    'transaction_intents',
    'transactionIntent',
  ]),
  references_policy_in_transaction: containsAny(['policy']),

  // Conceptual understanding
  explains_erc20_gas_flow: judge(
    'Does the code demonstrate how to pay for gas using an ERC-20 token (USDC) through Openfort, including registering the token contract and creating a policy with fixed_rate or charge_custom_tokens strategy?',
  ),
  targets_base_sepolia: judge(
    'Does the code specifically target the Base Sepolia testnet (chain ID 84532) for the ERC-20 gas payment transactions?',
  ),
})
