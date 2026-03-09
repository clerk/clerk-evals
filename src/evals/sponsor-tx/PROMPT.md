# Task

Implement gas-sponsored (gasless) transactions using the Openfort Node.js server SDK (`@openfort/openfort-node`).

## Requirements

Create a Node.js/TypeScript server application that:

1. Initializes the Openfort SDK using `OPENFORT_SECRET_KEY` and `OPENFORT_WALLET_SECRET` environment variables (loaded from `.env`)
2. Loads the policy ID from the `OPENFORT_POLICY_ID` environment variable (the policy is created by the user in the Openfort dashboard)
3. Creates a fee sponsorship linked to the policy using the `pay_for_user` sponsor schema
4. Registers a smart contract
5. Creates a transaction intent that executes a sponsored contract interaction (e.g. minting a token)

## Expected Output

The code should demonstrate the full fee sponsorship flow:

- SDK initialization: `new Openfort(process.env.OPENFORT_SECRET_KEY, { walletSecret: process.env.OPENFORT_WALLET_SECRET })` — keys must come from environment variables, never hardcoded
- Policy ID loaded from environment: `process.env.OPENFORT_POLICY_ID` — the policy is configured by the user in the Openfort dashboard, not created programmatically
- Fee sponsorship creation: `openfort.feeSponsorship.create(...)` with a `pay_for_user` strategy and the policy ID from the environment variable
- Contract registration: `openfort.contracts.create(...)` with chain ID and contract address
- Transaction intent: `openfort.transactionIntents.create(...)` with chain ID, policy/sponsorship reference, and interactions array containing contract ID, function name, and arguments
