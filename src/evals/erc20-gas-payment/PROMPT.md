# Task

Implement ERC-20 token gas payment in a React application using Openfort on the Base Sepolia testnet. Users should pay for gas fees using USDC instead of native ETH.

## Requirements

Create a React app that:

1. Configures Openfort with the proper providers (OpenfortProvider, WagmiProvider, QueryClientProvider) targeting the **Base Sepolia** testnet (chain ID 84532)
2. Registers the USDC token contract on Base Sepolia (address `0x036CbD53842c5426634e7929541eC2318f3dCF7e`) with Openfort
3. Creates a gas policy using either the `fixed_rate` or `charge_custom_tokens` sponsor schema, referencing the USDC token contract so users pay gas fees in USDC
4. Creates a transaction intent that uses the ERC-20 gas payment policy
5. Shows the full flow: USDC contract registration, policy creation with token payment configuration, and sending a transaction where gas is paid in USDC
