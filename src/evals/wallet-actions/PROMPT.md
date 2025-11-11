# Task

Implement wallet actions (signing and sending transactions) in a React application using Openfort.

## Requirements

Create a React app that demonstrates common wallet operations:

1. Set up Openfort with proper wallet configuration
2. Demonstrate transaction signing:
   - Sign messages
   - Sign typed data
3. Demonstrate sending transactions:
   - Send native tokens (ETH, etc.)
   - Interact with smart contracts
4. Use Wagmi hooks for wallet operations (`useWalletClient`, `useAccount`, `useSendTransaction`, `useSignMessage`)
5. Show proper transaction status handling
6. Include error handling for failed transactions

## Acceptance Criteria

- Uses Wagmi hooks like `useWalletClient`, `useAccount`, `useSendTransaction`, or `useSignMessage`
- Demonstrates message signing functionality
- Shows how to send transactions using the embedded wallet
- Includes transaction status handling (pending, success, error)
- Demonstrates proper error handling
- Uses TypeScript with proper types
- Shows how to interact with blockchain (reading/writing)
- Mentions or demonstrates gas estimation
- Code follows React, Wagmi, and Openfort best practices

