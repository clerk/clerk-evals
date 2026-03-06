---
description: Export eval scores and publish them to the clerk/clerk docs repo for the LLM leaderboard
argument-hint: "[description of what changed, e.g. 'add Claude Opus 5.0', 'refresh all scores']"
allowed-tools: Read, Bash(bun:*), Bash(cp:*), Bash(git:*), Bash(gh:*), Glob, AskUserQuestion
---

# Publish Leaderboard Scores

Export eval results from the local database and publish them to the clerk/clerk docs repo as `llm-scores.json`.

## Input

`$ARGUMENTS` = Optional description of what changed. Examples:
- `add Claude Opus 5.0`
- `refresh all model scores`
- `update MCP scores for GPT-5.2`

If empty, the command will infer what changed from the diff.

## Your Task

### Step 1: Export Scores (in clerk-evals)

Run the export pipeline:

```bash
bun export-from-db.ts    # SQLite → scores.json + scores-mcp.json
bun merge-scores          # Merge baseline + MCP + Skills → llm-scores.json
```

Verify `llm-scores.json` was generated and is not empty.

### Step 2: Find the clerk/clerk Docs Repo

Search for the repo that contains `public/llm-scores.json`:

```bash
# Check common sibling locations
ls ../clerk/public/llm-scores.json 2>/dev/null
ls ../../clerk/public/llm-scores.json 2>/dev/null
```

Or search more broadly:

```bash
# Find repos with the leaderboard file
find ~ -maxdepth 4 -path "*/clerk/public/llm-scores.json" -not -path "*/node_modules/*" 2>/dev/null | head -5
```

If not found, ask the user for the path using AskUserQuestion.

Verify it's the right repo by checking for `src/app/(website)/llm-leaderboard/page.tsx`.

### Step 3: Copy and Show Diff

Copy the new scores to the docs repo:

```bash
cp llm-scores.json <clerk-repo-path>/public/llm-scores.json
```

Show what changed:

```bash
cd <clerk-repo-path>
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

In the clerk/clerk repo:

```bash
cd <clerk-repo-path>
git checkout -b railly/update-leaderboard-YYYY-MM-DD
git add public/llm-scores.json
git commit -m "feat: <description from $ARGUMENTS or inferred>"
git push -u origin railly/update-leaderboard-YYYY-MM-DD
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
  category: string        // "Auth", "Billing", etc.
  value: number           // 0.0-1.0 baseline score
  provider: string        // "anthropic", "openai", "google", "vercel"
  mcpScore?: number       // Score with MCP tools
  improvement?: number    // mcpScore - value
  skillsScore?: number    // Score with Clerk skills
  skillsImprovement?: number
  updatedAt?: string      // ISO timestamp
  tokens?: { promptTokens, completionTokens, totalTokens }
  costUsd?: number
  durationMs?: number
}
```

Consumed by `src/app/(website)/llm-leaderboard/page.tsx` in the clerk/clerk repo.

## Gotchas

- Never hardcode the clerk/clerk repo path — always discover it dynamically
- The `export-from-db.ts` script reads from `evals.db` in the current directory
- `merge-scores` reads `scores.json`, `scores-mcp.json`, and optionally `scores-skills.json`
- The clerk/clerk repo may have uncommitted changes — check `git status` before creating a branch
- If the clerk repo has a dirty working tree, stash or warn the user before proceeding
