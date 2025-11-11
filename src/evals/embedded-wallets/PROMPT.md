# Task

Implement embedded wallet creation and management in a React application using Openfort.

## Requirements

Create a React app that demonstrates embedded wallet functionality:

1. Set up Openfort with wallet configuration including:
   - Shield encryption keys
   - Wallet creation endpoint (if using automatic recovery)
2. Implement wallet creation flow
3. Display wallet information (address, balance)
4. Show how to interact with the created wallet
5. Use Openfort React hooks to manage wallet state
6. Support wallet operations like getting the wallet address and checking wallet status

## Acceptance Criteria

- Configures `walletConfig` in OpenfortProvider with `shieldPublishableKey`
- Optionally configures `createEncryptedSessionEndpoint` for automatic recovery
- Demonstrates wallet creation using Openfort UI components or hooks
- Shows how to access wallet information (address, status)
- Uses hooks like `useEmbeddedWallet`, `useWalletClient`, or similar from `@openfort/react`
- Demonstrates proper error handling for wallet operations
- Shows wallet address display
- Code includes TypeScript types
- Follows React and Openfort best practices

