import { contains, containsAny, defineGraders, judge } from '@/src/graders'

export const graders = defineGraders({
  imports_openfort_node: containsAny(['@openfort/openfort-node', 'openfort-node']),
  initializes_sdk: containsAny(['new Openfort', 'Openfort(']),
  loads_api_key_from_env: contains('process.env.OPENFORT_SECRET_KEY'),
  loads_wallet_secret_from_env: contains('process.env.OPENFORT_WALLET_SECRET'),
  uses_accounts_evm_backend: contains('accounts.evm.backend'),
  creates_wallet: containsAny(['backend.create()', '.backend.create()']),
  lists_wallets: containsAny(['backend.list', '.list(']),
  gets_wallet: containsAny(['backend.get', '.get(']),
  sends_transaction: contains('sendTransaction'),
  accesses_address: contains('.address'),
  has_chain_id: contains('chainId'),
  has_interactions_or_transfer: containsAny(['interactions', 'transfer', 'to:', 'value:']),
  demonstrates_wallet_lifecycle: judge(
    'Does the code demonstrate a complete backend wallet lifecycle: creating a wallet, retrieving it, and sending a transaction from it using the Openfort Node.js SDK?',
  ),
})
