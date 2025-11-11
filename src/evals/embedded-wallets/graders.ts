import { contains, containsAny, defineGraders, judge } from '@/src/graders'

export const graders = defineGraders({
  configures_wallet_config: contains('walletConfig'),
  has_shield_key: containsAny(['shieldPublishableKey', 'SHIELD_PUBLISHABLE_KEY']),
  mentions_wallet_creation: containsAny(['wallet creation', 'create wallet', 'createWallet']),
  uses_wallet_hooks: containsAny([
    'useEmbeddedWallet',
    'useWalletClient',
    'useWallet',
    'wallet hook',
  ]),
  displays_wallet_address: containsAny([
    'wallet address',
    'address',
    'account.address',
    'walletAddress',
  ]),
  handles_wallet_status: judge(
    'Does the code demonstrate how to check or handle wallet status (connected, disconnected, etc.)?',
  ),
  demonstrates_wallet_operations: judge(
    'Does the code show practical wallet operations like getting the address or checking balance?',
  ),
  proper_error_handling: judge('Does the code include error handling for wallet operations?'),
})
