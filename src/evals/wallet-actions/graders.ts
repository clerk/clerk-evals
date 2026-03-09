import { contains, containsAny, defineGraders, judge } from '@/src/graders'

export const graders = defineGraders({
  uses_wallet_client: containsAny(['useWalletClient', 'walletClient', 'wallet client']),
  uses_account_hook: contains('useAccount'),
  demonstrates_signing: containsAny(['signMessage', 'writeContract']),
  uses_wait_transaction_receipt: contains('useWaitForTransactionReceipt'),
  demonstrates_transactions: containsAny([
    'useWriteContract',
    'writeContract',
  ]),
  there_is_an_address: containsAny(['address']),
  handles_transaction_status: containsAny([
    'isLoading',
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
})
