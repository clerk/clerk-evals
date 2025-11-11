# Task

Demonstrate comprehensive usage of Openfort React hooks in a React application.

## Requirements

Create a React app that showcases various Openfort and Wagmi hooks:

1. Authentication hooks:
   - Check authentication state
   - Access user information
2. Wallet management hooks:
   - Access wallet information
   - Check connection status
   - Manage wallet client
3. Blockchain interaction hooks (from Wagmi):
   - `useAccount` - Get connected account info
   - `useWalletClient` - Access wallet client
   - `useBalance` - Get account balance
   - `useChainId` - Get current chain ID
   - `useSwitchChain` - Switch between chains
4. Show practical examples of using these hooks in components
5. Demonstrate proper TypeScript usage with hook return types

## Acceptance Criteria

- Uses `useAccount` to access account information
- Uses `useWalletClient` or equivalent for wallet operations
- Demonstrates balance checking with `useBalance` or similar
- Shows chain management with `useChainId` and/or `useSwitchChain`
- Demonstrates authentication state management
- Includes at least 5 different hooks from Openfort/Wagmi
- Shows practical use cases in React components
- Proper TypeScript types for hook returns
- Demonstrates conditional rendering based on hook states
- Code follows React hooks best practices (proper dependencies, etc.)

