import { contains, containsAny, defineGraders, judge } from '@/src/graders'

export const graders = defineGraders({
  uses_wallet_client: containsAny(['useWalletClient', 'walletClient', 'wallet client']),
  uses_account_hook: contains('useAccount'),
  demonstrates_signing: containsAny(['useSignMessage', 'signMessage', 'sign message', 'signing']),
  demonstrates_transactions: containsAny([
    'useSendTransaction',
    'sendTransaction',
    'send transaction',
    'transaction',
  ]),
  handles_transaction_status: containsAny([
    'transaction status',
    'isPending',
    'isSuccess',
    'isError',
    'status',
  ]),
  demonstrates_error_handling: judge(
    'Does the code include proper error handling for transaction failures?',
  ),
  shows_blockchain_interaction: judge(
    'Does the code demonstrate practical blockchain interaction (reading/writing data, sending transactions)?',
  ),
  uses_proper_types: judge('Does the code use TypeScript with proper types for wallet operations?'),
})
