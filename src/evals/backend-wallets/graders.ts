import { contains, containsAny, defineGraders, judge } from '@/src/graders'

export const graders = defineGraders({
  imports_openfort_node: contains('@openfort/openfort-node'),
  creates_openfort_instance: contains('new Openfort'),
  uses_secret_key: containsAny(['sk_test_', 'sk_live_', 'OPENFORT_API_KEY']),
  configures_wallet_secret: contains('walletSecret'),
  creates_backend_wallet: containsAny(['accounts.evm.backend.create', 'backend.create']),
  accesses_wallet_address: contains('.address'),
  uses_env_variables: containsAny(['process.env', 'OPENFORT_API_KEY', 'OPENFORT_WALLET_SECRET']),
  demonstrates_error_handling: judge(
    'Does the code include proper error handling (try/catch blocks or .catch()) for backend wallet creation and operations?',
  ),
  explains_backend_wallet_concept: judge(
    'Does the response explain or demonstrate that backend wallets are server-side, developer-controlled custodial wallets managed by Openfort?',
  ),
})
