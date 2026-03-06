---
description: Register a new LLM model in the evaluation pipeline
argument-hint: <provider/model-name, e.g. "anthropic/claude-opus-5-0">
allowed-tools: Read, Write, Bash(bun:*), Glob, WebFetch
---

# Add Model to Eval Pipeline

Register a new LLM model so it can be evaluated by the clerk-evals suite.

## Input

`$ARGUMENTS` = Provider and model name in `provider/model-name` format.
Examples: `anthropic/claude-opus-5-0`, `openai/gpt-6`, `google/gemini-3-flash`

## Three Files Must Be Updated (in sync)

Adding a model requires editing exactly three files. Missing any one causes silent failures.

### 1. `src/config/models.ts` — Model registration

Add to the appropriate `MODELS[provider]` array:

```typescript
{ provider: 'anthropic', name: 'claude-opus-5-0', label: 'Claude Opus 5' },
```

Fields:
- `provider`: Must be one of `'openai' | 'anthropic' | 'vercel' | 'google'`
- `name`: Exact API model identifier (e.g., `claude-opus-5-0`, NOT `claude-opus-5.0`)
- `label`: Human-readable display name (shown in console reporter and leaderboard)

### 2. `src/runners/shared.ts` — Pricing entry

Add to the `MODEL_PRICING` record:

```typescript
'claude-opus-5-0': [inputPerM, outputPerM],  // USD per 1M tokens
```

Pricing sources (verify before adding):
- OpenAI: https://platform.openai.com/docs/pricing
- Anthropic: https://docs.anthropic.com/en/docs/about-claude/models
- Google: https://ai.google.dev/gemini-api/docs/pricing

If pricing is unknown (e.g., preview models), omit the entry. `estimateCost()` returns `undefined` for missing models — this is fine.

### 3. `run-evals.sh` — Runner script

Add the model name string to the `ALL_MODELS` bash array:

```bash
ALL_MODELS=(
  # ... existing models ...
  "claude-opus-5-0"   # <-- add here
)
```

This ensures `./run-evals.sh` (full leaderboard) includes the new model.

## Your Task

### Step 1: Parse Input

Extract provider and model name from `$ARGUMENTS`.

### Step 2: Verify Provider Support

Check `src/providers/index.ts` — the `Provider` type must include the provider. Currently supported:
- `openai` → uses `OPENAI_API_KEY`
- `anthropic` → uses `ANTHROPIC_API_KEY`
- `google` → uses `GOOGLE_API_KEY`
- `vercel` → uses `V0_API_KEY`

If adding a new provider, you must also:
1. Add the provider to the `Provider` union type in `src/providers/index.ts`
2. Add the SDK dependency (e.g., `bun add @ai-sdk/newprovider`)
3. Create a client and add the case to `getModel()`

### Step 3: Look Up Pricing

Fetch the provider's pricing page to get current rates (USD per 1M tokens).

### Step 4: Present Changes (STOP HERE FOR CONFIRMATION)

Show the user exactly what will change in each file:

```
Model: claude-opus-5-0 (Claude Opus 5)
Provider: anthropic
Pricing: $X/1M input, $Y/1M output

Files to modify:
1. src/config/models.ts — add to MODELS.anthropic[]
2. src/runners/shared.ts — add to MODEL_PRICING
3. run-evals.sh — add to ALL_MODELS[]
```

**DO NOT edit files until the user confirms.**

### Step 5: Apply Changes

Edit all three files.

### Step 6: Verify

Run a smoke test:

```bash
bun start --model "claude-opus-5-0" --smoke --debug
```

Check that:
- Model is discovered (appears in `--dry` output)
- API call succeeds (no auth errors)
- Score is computed
- `costUsd` is populated (if pricing was added)

## Gotchas

- The `name` field must match the exact model ID the provider's API expects
- Don't confuse `name` (API ID) with `label` (display name)
- Vercel models use `V0_API_KEY`, not `VERCEL_API_KEY`
- If the model uses a new provider, that's a bigger change — flag it to the user
