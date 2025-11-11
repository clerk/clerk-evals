import { contains, containsAny, defineGraders, judge } from '@/src/graders'

export const graders = defineGraders({
  configures_wallet_recovery: contains('walletRecovery'),
  uses_recovery_method_enum: contains('RecoveryMethod'),
  mentions_automatic_recovery: containsAny([
    'RecoveryMethod.AUTOMATIC',
    'AUTOMATIC',
    'automatic recovery',
  ]),
  mentions_passkey_recovery: containsAny([
    'RecoveryMethod.PASSKEY',
    'PASSKEY',
    'passkey',
    'biometric',
  ]),
  mentions_password_recovery: containsAny([
    'RecoveryMethod.PASSWORD',
    'PASSWORD',
    'password recovery',
  ]),
  sets_default_method: containsAny(['defaultMethod', 'default method']),
  has_encryption_session_endpoint: containsAny([
    'createEncryptedSessionEndpoint',
    'encryption session',
    'encrypted session',
  ]),
  explains_recovery_flow: judge(
    'Does the code explain or demonstrate how the wallet recovery process works for users?',
  ),
  mentions_backend_requirements: judge(
    'Does the code mention or explain backend requirements for recovery (especially for automatic recovery)?',
  ),
})
