import { contains, containsAny, defineGraders, judge } from '@/src/graders'

export const graders = defineGraders({
  configures_wallet_recovery: contains('walletRecovery'),
  uses_recovery_method_enum: contains('RecoveryMethod'),
  uses_shield_key: containsAny(['publishableKey', 'PUBLISHABLE_KEY']),
  uses_publishable_key: containsAny(['shieldPublishableKey', 'SHIELD_PUBLISHABLE_KEY']),
  mentions_automatic_recovery: containsAny([
    'RecoveryMethod.AUTOMATIC',
  ]),
  mentions_passkey_recovery: containsAny([
    'RecoveryMethod.PASSKEY',
  ]),
  mentions_password_recovery: containsAny([
    'RecoveryMethod.PASSWORD',
  ]),
  sets_default_method: containsAny(['defaultMethod']),
  has_encryption_session_endpoint: containsAny([
    'createEncryptedSessionEndpoint',
  ]),
  explains_recovery_flow: judge(
    'Does the code explain or demonstrate how the wallet recovery process works for users?',
  ),
  mentions_backend_requirements: judge(
    'Does the code mention or explain backend requirements for recovery (especially for automatic recovery)?',
  ),
})
