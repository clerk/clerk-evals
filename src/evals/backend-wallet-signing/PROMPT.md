# Task

Implement signing operations with Openfort backend wallets using the `@openfort/openfort-node` SDK in a server-side TypeScript application.

## Requirements

Create a Node.js/TypeScript application that:

1. Configures the `@openfort/openfort-node` SDK with proper authentication
2. Creates or retrieves a backend EVM wallet
3. Signs a plain text message using `signMessage`
4. Signs a raw transaction using `signTransaction`
5. Signs EIP-712 typed data using `signTypedData`
6. Demonstrates verification of signatures using `viem`
7. Shows a practical use case (e.g., treasury operations, automated transactions, or meta-transaction relaying)
8. Uses environment variables for sensitive keys
9. Includes proper error handling for all signing operations

## SDK Documentation

> **Important**: The `@openfort/openfort-node` SDK was completely rewritten at version 0.7.0 (January 2026). The information below reflects the current API.

### Installation

```bash
npm install @openfort/openfort-node viem
```

### Initialization

```typescript
import Openfort from "@openfort/openfort-node";

const openfort = new Openfort(process.env.OPENFORT_API_KEY!, {
  walletSecret: process.env.OPENFORT_WALLET_SECRET!,
});
```

### Signing Operations

**Sign a message:**
```typescript
const account = await openfort.accounts.evm.backend.create();

// Sign a plain text message
const signature = await account.signMessage({
  message: "Hello, Openfort!",
});
```

**Sign a transaction:**
```typescript
import { parseEther } from "viem";

const signedTx = await account.signTransaction({
  to: "0x1234567890abcdef1234567890abcdef12345678",
  value: parseEther("0.001"),
  nonce: 0,
  gas: 21000n,
  maxFeePerGas: 20000000000n,
  maxPriorityFeePerGas: 1000000000n,
  chainId: 80002,
});
```

**Sign EIP-712 typed data:**
```typescript
const domain = {
  name: "MyDApp",
  version: "1",
  chainId: 80002,
  verifyingContract: "0x...",
} as const;

const types = {
  Transfer: [
    { name: "to", type: "address" },
    { name: "amount", type: "uint256" },
  ],
} as const;

const typedSignature = await account.signTypedData({
  domain,
  types,
  primaryType: "Transfer",
  message: {
    to: "0x...",
    amount: 1000000n,
  },
});
```

### Signature Verification with viem

```typescript
import { verifyMessage, verifyTypedData } from "viem";

// Verify a message signature
const isValid = await verifyMessage({
  address: account.address,
  message: "Hello, Openfort!",
  signature,
});

// Verify typed data signature
const isTypedValid = await verifyTypedData({
  address: account.address,
  domain,
  types,
  primaryType: "Transfer",
  message: { to: "0x...", amount: 1000000n },
  signature: typedSignature,
});
```

### Account Signing Types (from viem)

```typescript
import type { Hash, Hex, SignableMessage, TransactionSerializable } from "viem";
import type { TypedDataDefinition } from "viem";

interface EvmSigningMethods {
  sign(parameters: { hash: Hash }): Promise<Hex>;
  signMessage(parameters: { message: SignableMessage }): Promise<Hex>;
  signTransaction(transaction: TransactionSerializable): Promise<Hex>;
  signTypedData<T, P>(parameters: TypedDataDefinition<T, P>): Promise<Hex>;
}
```
