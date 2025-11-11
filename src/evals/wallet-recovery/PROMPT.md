# Task

Implement wallet recovery methods in a React application using Openfort's embedded wallet infrastructure.

## Requirements

Create a React app that demonstrates different wallet recovery methods:

1. Configure wallet recovery in the `uiConfig.walletRecovery` section
2. Support multiple recovery methods:
   - **Automatic recovery**: No user action required, backend-managed
   - **Passkey recovery**: Biometric or device authentication
   - **Password recovery**: User-set password
3. Set the default recovery method
4. For automatic recovery, configure the backend endpoint (`createEncryptedSessionEndpoint`)
5. Demonstrate how recovery works in the application flow

## Acceptance Criteria

- Configures `uiConfig.walletRecovery` in OpenfortProvider
- Mentions or uses `RecoveryMethod` enum from `@openfort/react`
- References at least two recovery methods: AUTOMATIC, PASSKEY, or PASSWORD
- Sets `defaultMethod` in walletRecovery configuration
- For automatic recovery, includes `createEncryptedSessionEndpoint` configuration
- Explains or demonstrates how recovery process works for users
- Includes TypeScript types
- Discusses backend requirements for automatic recovery (optional but preferred)
- Code follows Openfort best practices

