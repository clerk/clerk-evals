# clerk-evals

LLM evaluation suite for Clerk code generation. Tests models across 7 product categories with 18 evaluations.

![diagram](./docs/diagram.jpg)

## Setup

```bash
cp .env.example .env  # Add API keys
bun i
```

## Quick Run

```bash
bun start                           # All models, baseline
bun start --mcp                     # All models, with MCP tools
bun start --model claude-sonnet-4-0 # Single model (exact name)
bun start --eval auth               # Filter by category
bun start --debug                   # Save outputs to debug-runs/
```

## Full Workflow (for llm-leaderboard)

```bash
./run-evals.sh                      # Run all models → export → llm-scores.json
```

Or step by step:

```bash
bun start                           # 1. Baseline → scores.json
bun start --mcp                     # 2. MCP → scores-mcp.json
bun export-from-db.ts               # 3. Export latest from DB
bun merge-scores                    # 4. Merge → llm-scores.json
cp llm-scores.json ~/Clerk/clerk/public/
```

### run-evals.sh Options

```bash
./run-evals.sh --list               # Show all models
./run-evals.sh --models "GPT-5.2"   # Filter models (fuzzy match)
./run-evals.sh --baseline-only      # Skip MCP runs
./run-evals.sh --mcp-only           # Skip baseline runs
./run-evals.sh --no-export          # Skip export step
```

## Categories (7)

| Category | Evals | Focus |
|----------|-------|-------|
| Quickstarts | 2 | Next.js, React Vite setup |
| Auth | 2 | Route protection, middleware |
| User Management | 1 | Profile pages, currentUser |
| UI Components | 4 | Appearance API, customization |
| Organizations | 2 | Multi-tenancy, org switching |
| Webhooks | 3 | Svix verification, event handling |
| Billing | 4 | Checkout, subscriptions |

## Models (14)

**Anthropic**: Claude Sonnet 4, Sonnet 4.5, Opus 4, Opus 4.5, Haiku 4.5
**OpenAI**: GPT-4o, GPT-5, GPT-5 Chat, GPT-5.2, GPT-5.2 Codex
**Google**: Gemini 2.5 Flash, Gemini 3 Pro Preview
**Vercel**: v0-1.5-md, v0-1.5-lg

## Add New Eval

```bash
/new-eval https://clerk.com/docs/...  # Claude Code command
```

Or manually: see [docs/ADDING_EVALS.md](./docs/ADDING_EVALS.md)

## Output

```json
{
  "model": "claude-sonnet-4-0",
  "label": "Claude Sonnet 4",
  "category": "Auth",
  "value": 0.83,
  "mcpScore": 0.95,
  "improvement": 0.12
}
```

## Architecture

- `src/config/` - Models and evaluations registry
- `src/evals/` - PROMPT.md + graders.ts per eval
- `src/runners/` - Baseline and MCP runners
- `src/graders/` - Shared grader primitives and catalog
- `run-evals.sh` - Sequential runner with timeout/retry
- `export-from-db.ts` - Export latest results from SQLite
