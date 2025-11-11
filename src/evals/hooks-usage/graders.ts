import { contains, containsAny, defineGraders, judge } from '@/src/graders'

export const graders = defineGraders({
  uses_use_account: contains('useAccount'),
  uses_wallet_client_hook: containsAny(['useWalletClient', 'walletClient', 'wallet client']),
  uses_balance_hook: containsAny(['useBalance', 'balance']),
  uses_chain_hooks: containsAny(['useChainId', 'useSwitchChain', 'chainId', 'switch chain']),
  demonstrates_auth_state: containsAny(['authentication', 'auth', 'isAuthenticated', 'user']),
  uses_multiple_hooks: judge(
    'Does the code demonstrate usage of at least 5 different hooks from Openfort or Wagmi?',
  ),
  shows_practical_examples: judge(
    'Does the code show practical examples of using hooks in React components with real use cases?',
  ),
  conditional_rendering: judge(
    'Does the code demonstrate conditional rendering or logic based on hook states (loading, error, data)?',
  ),
  proper_typescript: judge(
    'Does the code use TypeScript with proper types for hook return values?',
  ),
})
