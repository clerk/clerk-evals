---
description: Create a new Openfort eval from docs URL or feature description
argument-hint: <openfort-docs-url-or-description>
allowed-tools: Read, Write, Bash(mkdir:*), Glob, WebFetch
---

# Create New Openfort Eval

Create a new evaluation for the openfort-evals suite based on Openfort documentation or a feature description.

## Input

`$ARGUMENTS` = Either:
- An Openfort docs URL (e.g., `https://www.openfort.xyz/docs/guides/wallets/embedded`)
- A feature description (e.g., "create an embedded wallet and send a sponsored transaction")

## Your Task

### Step 1: Analyze the Input

If URL provided:
- Fetch the docs page using WebFetch
- Extract the core feature/component being documented
- Identify the key use cases and configuration options

If description provided:
- Parse the feature request
- Identify which Openfort feature it relates to

### Step 2: Propose the Eval (STOP HERE FOR CONFIRMATION)

Present a summary to the user:

```
Based on the input, I propose:

Category: <category>
Slug: <kebab-case-name>
Focus: <1-2 sentence description of what this eval tests>

PROMPT.md will test:
- <key capability 1>
- <key capability 2>

Graders will check:
- <grader 1>
- <grader 2>

Proceed? (y/n)
```

**DO NOT create any files until the user confirms.**

### Step 3: Create the Eval (after confirmation)

1. **Create directory**: `src/evals/<category>/<slug>/`

2. **Create PROMPT.md**:
   - Start with `# Task`
   - One or two sentences describing WHAT to build, not HOW
   - Focus on the use case and desired outcome
   - Don't list implementation details (no prop names, no file paths)

3. **Create graders.ts**:
   - Import from `@/src/graders` and `@/src/graders/catalog`
   - Use `defineGraders()` to export
   - Start from template: `src/evals/_template/graders.ts`
   - Primitives: `contains()`, `containsAny()`, `matches()`, `judge()`
   - Catalog: `llmChecks.*`, `walletChecks.*`, `providerChecks.*`, `sponsorshipChecks.*`, `setupChecks.*`

   **Grader Best Practices** (prefer code over judges):

   Available primitives (from `@/src/graders`):
   - `contains(needle)` — case-insensitive substring match
   - `containsAny(needles[])` — match any substring
   - `containsAll(needles[])` — match all substrings
   - `matches(regex)` — regex test
   - `not(grader)` — negate a grader
   - `all(...graders)` — AND composition
   - `any(...graders)` — OR composition
   - `judge(criteria)` — LLM judge (last resort)

   Catalog (from `@/src/graders/catalog`):
   - `llmChecks.packageJsonOpenfortDeps` — checks for @openfort/* packages
   - `llmChecks.environmentVariables` — checks .env.local has OPENFORT keys
   - `walletChecks.*` — createWallet, sendTransaction, writeContract
   - `providerChecks.*` — OpenfortProvider, WagmiProvider, QueryClientProvider
   - `sponsorshipChecks.*` — feeSponsorship, transactionIntents, policyId
   - `setupChecks.*` — SDK initialization, server-side key usage

   **When to use `judge()` vs code graders**:
   - Use code graders when checking string presence/absence: `contains('createWallet')`, `not(contains('deprecated'))`
   - Use composites for multi-condition checks: `all(contains('openfort'), contains('policyId'))`
   - Only use `judge()` when criteria requires semantic understanding (logic flow, data relationships, ordering)
   - Each `judge()` call costs ~$0.003 and introduces non-determinism — avoid when possible

   **Examples**:
   ```typescript
   // GOOD: deterministic code graders
   openfort_import: contains('@openfort/openfort-node'),
   has_policy: contains('policyId'),
   wallet_and_tx: all(contains('createWallet'), contains('sendTransaction')),
   uses_any_sdk: containsAny(['@openfort/openfort-node', '@openfort/openfort-js', '@openfort/react']),

   // OK: judge for semantic checks only
   correct_flow: judge('Does the solution create a wallet before sending a transaction?'),
   ```

4. **Register** in `src/config/evaluations.ts`:
   ```typescript
   { framework: 'Next.js', category: '<Category>', path: 'evals/<category>/<slug>' },
   ```

5. **Run lint**: `bun run check`

## Categories

| Category | Slug | Framework | Focus |
|----------|------|-----------|-------|
| Setup | `setup` | Next.js, React | Initial SDK setup, provider config |
| Embedded Wallets | `embedded-wallets` | Next.js | Wallet creation, recovery |
| Wallet Actions | `wallet-actions` | Next.js | Transactions, contract interactions |
| Sponsor Transactions | `sponsor-transactions` | Next.js | Fee sponsorship, policies |
| Backend Wallets | `backend-wallets` | Next.js | Server-side wallet operations |
| Authentication | `authentication` | Next.js | Auth flows, session management |

## Output

After creating the eval, show:
1. The created PROMPT.md content
2. The created graders.ts content
3. The updated line in evaluations.ts
4. Suggested verification: `bun start --eval "<slug>" --model "claude-opus-4-6" --smoke --debug`
