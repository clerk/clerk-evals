import { contains, containsAny, defineGraders, judge } from '@/src/graders'

export const graders = defineGraders({
  uses_use_account: contains('useAccount'),
  uses_wallets_hook: containsAny(['useWallets']),
  uses_balance_hook: containsAny(['useBalance']),
  uses_chain_hooks: containsAny(['useChainId', 'useSwitchChain']),
  demonstrates_auth_state: containsAny(['isAuthenticated']),
  uses_use_user_hook: contains('useUser'),
  uses_wagmi: contains('wagmi'),
  uses_openfort_react: contains('@openfort/react'),
})
