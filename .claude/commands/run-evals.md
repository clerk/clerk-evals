---
description: Execute eval runs with correct flag combinations for common scenarios
argument-hint: <scenario, e.g. "smoke claude-opus-4-6", "full leaderboard", "mcp comparison gpt-5">
allowed-tools: Bash(bun:*), Bash(./run-evals.sh:*), Read, Glob
---

# Run Evaluations

Execute clerk-evals runs with the right flags for common scenarios.

## Input

`$ARGUMENTS` = A scenario description. Examples:
- `smoke claude-opus-4-6` — quick smoke test with one model
- `full leaderboard` — all models, all modes, export to clerk repo
- `mcp comparison claude-sonnet-4-5` — baseline vs MCP for one model
- `single eval auth/protect` — one eval across all models
- `debug gpt-5 billing` — debug a specific model + category

## Execution Modes

| Mode | Flag | Output File | What It Tests |
|------|------|-------------|---------------|
| Baseline | _(none)_ | `scores.json` | Pure LLM, no tools |
| MCP | `--mcp` | `scores-mcp.json` | With MCP server tools |
| Skills | `--skills` | `scores-skills.json` | With Clerk skill files |

## Model Names (exact match required)

These are the `name` values from `src/config/models.ts`. Use these exactly:

**OpenAI**: `gpt-4o`, `gpt-5`, `gpt-5-chat-latest`, `gpt-5.2`, `gpt-5.2-codex`
**Anthropic**: `claude-sonnet-4-0`, `claude-sonnet-4-5`, `claude-opus-4-0`, `claude-opus-4-5`, `claude-opus-4-6`, `claude-haiku-4-5`
**Google**: `gemini-2.5-flash`, `gemini-3-pro-preview`
**Vercel**: `v0-1.5-md`, `v0-1.5-lg`

Model filtering is case-insensitive but must match the `name` field, NOT the `label`.

## Eval Filtering

`--eval` accepts any of:
- Category name: `auth`, `billing`, `webhooks`
- Partial path: `auth/protect`, `billing/checkout-new`
- Full path: `evals/auth/protect`

## Your Task

### Step 1: Parse the Scenario

Identify from `$ARGUMENTS`:
- Which model(s) to run
- Which eval(s) to filter (if any)
- Which mode(s) (baseline, MCP, skills)
- Whether debug output is needed

### Step 2: Preview with --dry

Always run `--dry` first to show the task matrix without executing:

```bash
bun start --model "claude-opus-4-6" --eval "auth" --dry
```

Present the output to the user and confirm before executing.

### Step 3: Execute

Run the actual evaluation. Common patterns:

```bash
# Smoke test (1 task only)
bun start --model "claude-opus-4-6" --smoke --debug

# Single model, all evals, with debug
bun start --model "claude-opus-4-6" --debug

# Single model + single eval
bun start --model "gpt-5" --eval "auth/protect" --debug

# MCP mode for one model
bun start --mcp --model "claude-sonnet-4-5" --debug

# Skills mode for one model
bun start --skills --model "claude-opus-4-6" --debug

# Compare baseline vs MCP (run both)
bun start --model "claude-opus-4-6" --debug
bun start --mcp --model "claude-opus-4-6" --debug

# All models in a category
bun start --eval "billing"

# CI gate (fail if avg < 70%)
bun start --model "claude-opus-4-6" --fail-under 70
```

### Step 4: Full Leaderboard Workflow

For a complete leaderboard refresh, use the runner script:

```bash
# All models, baseline + MCP, with export
./run-evals.sh

# Specific models only
./run-evals.sh --models "gpt-5,claude-opus-4-6"

# Baseline only (skip MCP)
./run-evals.sh --baseline-only

# MCP only (skip baseline)
./run-evals.sh --mcp-only

# List available models
./run-evals.sh --list
```

The runner script handles:
- 5 min timeout per model
- 2 retry attempts for failures
- Auto-exports to `llm-scores.json`

### Step 5: Report Results

After execution:
1. Read the output scores file (`scores.json`, `scores-mcp.json`, or `scores-skills.json`)
2. Summarize: per-model averages, per-category breakdown
3. Flag any scores below 50% (likely regressions or broken evals)

### Step 6: Publish to Leaderboard (optional)

After reporting results, ask the user:

> "Do you want to publish the updated scores to the LLM leaderboard?"

If yes, run `/publish-leaderboard` to export, copy to the docs repo, and optionally create a draft PR.

## Environment Variables

| Variable | Required For | Default |
|----------|-------------|---------|
| `ANTHROPIC_API_KEY` | Claude models | - |
| `OPENAI_API_KEY` | GPT models | - |
| `GOOGLE_API_KEY` | Gemini models | - |
| `V0_API_KEY` | Vercel models | - |
| `MCP_SERVER_URL_OVERRIDE` | Local MCP testing | `https://mcp.clerk.dev/mcp` |
| `BRAINTRUST_API_KEY` | Braintrust export | _(optional)_ |

## Gotchas

- Model names are NOT labels: use `claude-opus-4-6` not `Claude Opus 4.6`
- `--eval` does substring matching: `auth` matches both `auth/protect` and `auth/routes`
- MCP mode connects to `mcp.clerk.dev` by default — use `MCP_SERVER_URL_OVERRIDE` for local
- Skills mode looks for skills at `../skills/skills` relative to cwd — override with `--skills-path`
- `--debug` creates artifacts in `debug-runs/` — useful for investigating grader failures
- The SQLite DB (`evals.db`) accumulates all runs. Use `bun export-from-db.ts` to extract latest averages
