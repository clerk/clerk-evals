import { contains, containsAny, defineGraders, judge } from '@/src/graders'

export const graders = defineGraders({
  has_openfort_react_import: contains('@openfort/react'),
  mentions_wallet_creation: containsAny(['createWallet']),
  uses_wallet_hooks: containsAny([
    'useWallet',
    'useWallets',
  ]),
  displays_wallet_address: containsAny([
    '.address',
    '.ownerAddress'
  ]),
  handles_wallet_status: judge(
    'Does the code demonstrate how to check or handle wallet status (connected, disconnected, etc.)?',
  ),
  demonstrates_wallet_operations: judge(
    'Does the code show practical wallet operations like getting the address or checking balance?',
  ),
  proper_error_handling: judge('Does the code include error handling for wallet operations?'),
})
