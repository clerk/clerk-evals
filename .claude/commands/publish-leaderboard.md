---
description: Export eval scores and publish them for the LLM leaderboard
argument-hint: "[description of what changed, e.g. 'add Claude Opus 5.0', 'refresh all scores']"
allowed-tools: Read, Bash(bun:*), Bash(cp:*), Bash(git:*), Bash(gh:*), Glob, AskUserQuestion
---

# Publish Leaderboard Scores

Export eval results from the local database and publish them as `llm-scores.json`.

## Input

`$ARGUMENTS` = Optional description of what changed. Examples:
- `add Claude Opus 5.0`
- `refresh all model scores`
- `update MCP scores for GPT-5.2`

If empty, the command will infer what changed from the diff.

## Your Task

### Step 1: Export Scores (in openfort-evals)

Run the export pipeline:

```bash
bun export-from-db.ts    # SQLite → scores.json + scores-mcp.json
bun merge-scores          # Merge baseline + MCP + Skills → llm-scores.json
```

Verify `llm-scores.json` was generated and is not empty.

### Step 2: Find the Target Repo

Search for the repo that contains `public/llm-scores.json`:

```bash
# Check common sibling locations
ls ../openfort-docs/public/llm-scores.json 2>/dev/null
ls ../../openfort-docs/public/llm-scores.json 2>/dev/null
```

If not found, ask the user for the path using AskUserQuestion.

### Step 3: Copy and Show Diff

Copy the new scores to the target repo:

```bash
cp llm-scores.json <target-repo-path>/public/llm-scores.json
```

Show what changed:

```bash
cd <target-repo-path>
git diff --stat public/llm-scores.json
git diff public/llm-scores.json | head -100
```

Summarize the changes for the user:
- New models added (if any)
- Score changes (significant deltas)
- New categories or frameworks

### Step 4: Ask About Draft PR

Use AskUserQuestion to ask:

> "Leaderboard scores updated locally. Want to create a draft PR?"

Options:
- **Create draft PR** — branch + commit + push + `gh pr create --draft`
- **Leave local** — keep changes unstaged for manual handling

### Step 5: Create Draft PR (if approved)

In the target repo:

```bash
cd <target-repo-path>
git checkout -b $USER/update-leaderboard-YYYY-MM-DD
git add public/llm-scores.json
git commit -m "feat: <description from $ARGUMENTS or inferred>"
git push -u origin $USER/update-leaderboard-YYYY-MM-DD
gh pr create --draft \
  --title "feat: <description>" \
  --body "Update LLM leaderboard scores.\n\nChanges:\n- <summary of diff>"
```

**Commit message conventions** (match existing history):
- `feat: add Claude Opus 5.0 to LLM leaderboard`
- `feat: update LLM leaderboard scores`
- `feat: add iOS Swift skill scores to LLM leaderboard`
- `feat: refresh leaderboard scores (March 2026)`

### Step 6: Report

Show the user:
- PR URL (if created)
- Summary of score changes
- Any models with scores below 50% (potential issues)

## Data Format Reference

`llm-scores.json` is an array of enhanced score objects:

```typescript
{
  model: string           // "claude-opus-4-6"
  label: string           // "Claude Opus 4.6"
  framework: string       // "Next.js"
  category: string        // "Setup", "Embedded Wallets", etc.
  value: number           // 0.0-1.0 baseline score
  provider: string        // "anthropic", "openai", "google", "vercel"
  mcpScore?: number       // Score with MCP tools
  improvement?: number    // mcpScore - value
  skillsScore?: number    // Score with Openfort skills
  skillsImprovement?: number
  updatedAt?: string      // ISO timestamp
  tokens?: { promptTokens, completionTokens, totalTokens }
  costUsd?: number
  durationMs?: number
}
```

## Gotchas

- Never hardcode the target repo path — always discover it dynamically
- The `export-from-db.ts` script reads from `evals.db` in the current directory
- `merge-scores` reads `scores.json`, `scores-mcp.json`, and optionally `scores-skills.json`
- Check `git status` in the target repo before creating a branch
- If the target repo has a dirty working tree, stash or warn the user before proceeding
