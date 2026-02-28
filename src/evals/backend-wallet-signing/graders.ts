import { contains, containsAny, defineGraders, judge } from '@/src/graders'

export const graders = defineGraders({
  imports_openfort_node: contains('@openfort/openfort-node'),
  creates_openfort_instance: contains('new Openfort'),
  configures_wallet_secret: contains('walletSecret'),
  creates_or_gets_account: containsAny([
    'accounts.evm.backend.create',
    'accounts.evm.backend.get',
    'backend.create',
  ]),
  signs_message: contains('signMessage'),
  signs_transaction: contains('signTransaction'),
  signs_typed_data: contains('signTypedData'),
  imports_viem: contains('viem'),
  uses_viem_for_verification: containsAny([
    'verifyMessage',
    'verifyTypedData',
    'parseTransaction',
    'parseEther',
  ]),
  demonstrates_eip712: containsAny(['domain', 'types', 'primaryType']),
  proper_error_handling: judge(
    'Does the code include proper error handling for signing operations (try/catch blocks, error messages, or validation)?',
  ),
  demonstrates_practical_use: judge(
    'Does the code demonstrate a practical use case for backend wallet signing (e.g., treasury operations, automated transactions, meta-transaction relaying, or NFT minting)?',
  ),
})
