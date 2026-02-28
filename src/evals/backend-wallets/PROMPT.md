# Task

Implement backend wallet creation and management using Openfort's Node.js SDK (`@openfort/openfort-node`) in a server-side TypeScript application.

## Requirements

Create a Node.js/TypeScript application that:

1. Installs and configures the `@openfort/openfort-node` SDK (v0.9.x)
2. Creates a backend EVM wallet
3. Lists existing backend wallets
4. Retrieves a specific wallet by ID
5. Demonstrates signing a message with a backend wallet
6. Uses environment variables for sensitive keys (API secret key, wallet secret)
7. Includes proper error handling for all operations

## SDK Documentation

> **Important**: The `@openfort/openfort-node` SDK was completely rewritten at version 0.7.0 (January 2026). The information below reflects the current API. Previous versions (0.6.x and below) used a completely different, auto-generated API structure and are incompatible.

### Installation

```bash
npm install @openfort/openfort-node
```

### Initialization

```typescript
import Openfort from "@openfort/openfort-node";

const openfort = new Openfort("sk_test_...", {
  walletSecret: "your-wallet-secret",
});
```

The constructor takes:
- First argument: Your Openfort API secret key (starts with `sk_test_` or `sk_live_`)
- Second argument: Options object with `walletSecret` for backend wallet operations

### Backend Wallet Operations

**Create a backend EVM wallet:**
```typescript
const account = await openfort.accounts.evm.backend.create();
console.log("Wallet ID:", account.id);
console.log("Address:", account.address);
// account.custody === 'Developer'
```

**List backend wallets:**
```typescript
const wallets = await openfort.accounts.evm.backend.list();
```

**Get a specific wallet:**
```typescript
const wallet = await openfort.accounts.evm.backend.get(walletId);
```

**Sign a message:**
```typescript
const signature = await account.signMessage({ message: "Hello, Openfort!" });
```

### Account Types

```typescript
interface EvmAccountBase {
  id: string;
  address: Address;     // from viem
  custody: 'Developer';
}

interface EvmSigningMethods {
  sign(parameters: { hash: Hash }): Promise<Hex>;
  signMessage(parameters: { message: SignableMessage }): Promise<Hex>;
  signTransaction(transaction: TransactionSerializable): Promise<Hex>;
  signTypedData<T, P>(parameters: TypedDataDefinition<T, P>): Promise<Hex>;
}

type EvmAccount = EvmAccountBase & EvmSigningMethods;
```

### REST API Endpoints

All under `/v2/accounts/backend`:

| Operation | Method | Endpoint |
|-----------|--------|----------|
| List wallets | GET | `/v2/accounts/backend` |
| Create wallet | POST | `/v2/accounts/backend` |
| Get wallet | GET | `/v2/accounts/backend/{id}` |
| Update wallet | PUT | `/v2/accounts/backend/{id}` |
| Delete wallet | DELETE | `/v2/accounts/backend/{id}` |
| Sign data | POST | `/v2/accounts/backend/{id}/sign` |

### Environment Variables

Use these environment variables for configuration:
- `OPENFORT_API_KEY` - Your Openfort API secret key
- `OPENFORT_WALLET_SECRET` - Your wallet secret for backend wallet operations
