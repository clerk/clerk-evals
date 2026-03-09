# Task

Implement backend wallet management using the Openfort Node.js server SDK (`@openfort/openfort-node`).

## Requirements

Create a Node.js/TypeScript server application that:

1. Initializes the Openfort SDK using `OPENFORT_SECRET_KEY` and `OPENFORT_WALLET_SECRET` environment variables (loaded from `.env`)
2. Creates an EVM backend wallet
3. Lists backend wallets
4. Retrieves a specific wallet by ID or address
5. Sends a transaction from the backend wallet (e.g. a contract interaction or native transfer)

## Expected Output

The code should demonstrate backend wallet operations:

- SDK initialization: `new Openfort(process.env.OPENFORT_SECRET_KEY, { walletSecret: process.env.OPENFORT_WALLET_SECRET })` — keys must come from environment variables, never hardcoded
- EVM wallet creation: `openfort.accounts.evm.backend.create()`
- Listing wallets: `openfort.accounts.evm.backend.list(...)` with pagination
- Getting a wallet: `openfort.accounts.evm.backend.get(...)` by ID or address
- Sending a transaction: `openfort.accounts.evm.backend.sendTransaction(...)` with chain ID and interactions
- Accessing wallet properties like `address` and `id`
