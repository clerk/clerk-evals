---
description: Audit grader files to find LLM judges replaceable with deterministic code graders
argument-hint: "[category-filter, e.g. 'wallets', 'setup']"
allowed-tools: Read, Grep, Glob, AskUserQuestion
---

# Audit Graders

Scan all evaluation graders to identify `judge()` calls that can be replaced with deterministic code graders, reducing cost and non-determinism.

## Why This Matters

Each `judge()` call invokes GPT-4.1 (~$0.003 per call). With 15 models x N evals x ~2 judges per eval = many judge calls per full run. Replacing judges with `contains`/`matches`/`all` is free, deterministic, and faster.

## Input

`$ARGUMENTS` = Optional category filter (e.g., `wallets`, `setup`, `sponsor-transactions`).
If empty, audit all grader files.

## Available Grader Primitives

| Primitive | Usage | Example |
|-----------|-------|---------|
| `contains(needle)` | Case-insensitive substring | `contains('createWallet')` |
| `containsAny(needles[])` | Match any | `containsAny(['npm', 'bun', 'yarn'])` |
| `containsAll(needles[])` | Match all | `containsAll(['openfort', 'policyId'])` |
| `matches(regex)` | Regex test | `matches(/\.id\b/)` |
| `not(grader)` | Negate | `not(contains('deprecated'))` |
| `all(...graders)` | AND compose | `all(contains('x'), matches(/y/))` |
| `any(...graders)` | OR compose | `any(contains('a'), contains('b'))` |

Import from `@/src/graders`.

## Decision Framework

### REPLACE — Judge checks for string presence/absence

The judge criteria can be expressed as pattern matching.

**Before**: `judge('Does the solution import from @openfort/openfort-node?')`
**After**: `contains('@openfort/openfort-node')`

**Before**: `judge('Does the solution set up both a wallet and a transaction?')`
**After**: `all(contains('createWallet'), contains('sendTransaction'))`

### KEEP — Judge evaluates semantic correctness

The criteria requires understanding logic flow, data relationships, or multi-step reasoning.

**Keep**: `judge('Does the solution create the wallet before sending a transaction with it?')`
Reason: Checks ordering and data flow — can't be reduced to substring matching.

### SPLIT — Partially replaceable

Separate the pattern-matchable parts from the semantic parts.

## Catalog Judges

The file `src/graders/catalog.ts` defines shared judges used across multiple evals:

| Group | Judges |
|-------|--------|
| `llmChecks` | `packageJsonOpenfortDeps`, `environmentVariables` |
| `walletChecks` | `usesCreateWallet`, `usesSendTransaction`, `usesWriteContract` |
| `providerChecks` | `usesOpenfortProvider`, `usesWagmiProvider`, `usesQueryClientProvider` |
| `sponsorshipChecks` | `usesFeeSponsorship`, `usesTransactionIntent`, `usesPolicyId` |
| `setupChecks` | `initializesOpenfort`, `usesServerSideKey` |

Replacing a catalog judge impacts all evals that use it. Verify all consumers before changing.

## Your Task

### Step 1: Scan Grader Files

```
Glob: src/evals/**/graders.ts
```

If `$ARGUMENTS` specifies a category, filter to that subdirectory.

### Step 2: Find All Judge Calls

For each grader file:
- Grep for `judge(` — inline judges
- Grep for catalog imports (`llmChecks`, `walletChecks`, etc.) — shared judges

### Step 3: Classify Each Judge

Read the criteria string and classify as REPLACE / KEEP / SPLIT using the decision framework above.

### Step 4: Generate Audit Report

Present a table:

```
## Grader Audit Report

### Replaceable (estimated savings: ~$X per full run)

| Eval | Grader Key | Current | Proposed Replacement |
|------|-----------|---------|---------------------|
| auth/protect | no_deprecated | `judge('avoid authMiddleware...')` | `not(contains('authMiddleware'))` |
| webhooks/user-sync | has_email | `judge('Does it log email...')` | `contains('emailAddress')` |

### Keep (semantic checks)

| Eval | Grader Key | Reason |
|------|-----------|--------|
| billing/checkout | confirm_flow | Checks ordering and data flow |

### Catalog Judges (shared impact)

| Judge | Used By | Recommendation |
|-------|---------|----------------|
| `authUIChecks.usesSignedIn` | 3 evals | REPLACE: `contains('<SignedIn')` |
| `llmChecks.packageJsonClerkVersion` | 12 evals | KEEP: checks version comparison |
```

### Step 5: Estimate Savings

Calculate: `replaceable_count * 15_models * cost_per_judge (~$0.003)` = savings per full run.

## Post-Audit: Verification

After replacing judges, verify with:

```bash
bun start --eval "<affected-eval>" --model "claude-opus-4-6" --debug
bun start --eval "<affected-eval>" --model "gpt-5" --debug
```

Compare scores against the pre-replacement baseline. A well-replaced judge should produce equivalent or better scores.
