# Task

Implement fully sponsored transactions in a React application using Openfort on the Base Sepolia testnet. All gas fees should be paid by the application through a gas policy.

## Requirements

Create a React app that:

1. Configures Openfort with the proper providers (OpenfortProvider, WagmiProvider, QueryClientProvider) targeting the **Base Sepolia** testnet (chain ID 84532)
2. Creates a gas sponsorship policy using the Openfort API with the `pay_for_user` sponsor schema so the application covers all gas fees
3. Creates a transaction intent that references the sponsorship policy, so the user pays zero gas
4. Demonstrates how to register a smart contract with Openfort and add a policy rule to restrict sponsorship to specific contract functions
5. Shows the full flow: policy creation, contract registration, policy rule setup, and sending a sponsored transaction
