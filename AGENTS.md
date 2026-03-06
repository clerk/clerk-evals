# Repository Guidelines

## Goals
This project is meant for Clerk to write publicly viewable evals. These evals test how LLMs perform at writing code using Clerk.

## For AI Agents (default context)
You are operating in a repository whose sole purpose is to evaluate how well LLMs write Clerk code. When a user asks for something like "create a new eval suite for the Waitlist feature", follow the steps below by default.

- Create a new evaluation folder under `src/evals/` using a concise kebab-case slug, e.g. `src/evals/waitlist/`.
- Inside that folder, add two files:
  - `PROMPT.md`: plain-English task and acceptance criteria. Be explicit about the framework (Next.js) and Clerk expectations.
  - `graders.ts`: export a `graders` object using `defineGraders(...)` where each grader returns `boolean`. Prefer deterministic code graders (`contains`, `matches`, `all`, `not`) over LLM judges (`judge()`). Only use `judge()` for semantic checks that can't be expressed as pattern matching.
- Register the new evaluation path in `src/config/evaluations.ts` by appending an entry with `framework`, `category`, and `path`.
- Validate locally:
  - `bun start --eval "<slug>" --smoke --debug` to test with one model
  - `bun start` to run full suite
- Style and structure:
  - Keep files TypeScript ESNext. Use the `@/*` path alias.
  - Use Biome: `bun run lint:fix` before committing.

See `docs/ADDING_EVALS.md` for a concrete, copy-pastable template and end-to-end checklist.

## Available Commands

| Command | Purpose |
|---------|---------|
| `/new-eval <url-or-desc>` | Create new eval from docs URL or feature description |
| `/run-evals <scenario>` | Execute eval runs (smoke, single model, full suite, MCP comparison) |
| `/add-model <provider/name>` | Register new model (config + pricing + runner script) |
| `/analyze-results <type>` | Compare scores, find regressions, calculate MCP uplift, cost reports |
| `/audit-graders [category]` | Find LLM judges replaceable with deterministic code graders |
| `/publish-leaderboard [desc]` | Export scores and publish to clerk/clerk docs repo (draft PR) |

## Project Structure & Module Organization
`src/index.ts` wires providers, runners, reporters, and every folder under `src/evals`. Keep each evaluation in its own directory with `PROMPT.md`, `graders.ts`, and any fixtures it needs. Use descriptive, numeric-free slugs like `src/evals/new-eval`. Runner logic lives in `src/runners`, shared provider clients in `src/providers`, scoring helpers in `src/scorers`, and reusable utilities in `src/utils`. Diagrams intended for contributor onboarding belong in `docs/`, while transient artifacts like `scores.json` stay gitignored at the root.

## Environment Setup & Secrets
This project requires Bun `>=1.3.0`. Install dependencies with `bun install`, then copy `.env.example` to `.env` and populate `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, and `V0_API_KEY`. Avoid checking secrets into version control; reference them through `process.env` only.

For MCP evaluations, the runner connects to `https://mcp.clerk.dev/mcp` by default. Override with `MCP_SERVER_URL_OVERRIDE` for local testing.

## Build, Test, and Development Commands
`bun start` runs the full evaluation suite and writes reporter output to the console and `scores.json`. Target a single evaluation with `bun run start:eval src/evals/apiroutes`, and add `--debug` to capture prompts, responses, and grader decisions. Lint and format with `bun run lint`, `bun run lint:fix`, and `bun run format`; `bun run check` applies Biome's autofixes and unsafe rules when you need a full cleanup.

### MCP Evaluations
Run evaluations with MCP tool support using `bun start:mcp`. Connects to `https://mcp.clerk.dev/mcp` by default (zero-config):

```bash
# Production MCP server (default)
bun start:mcp

# Local MCP server override
MCP_SERVER_URL_OVERRIDE=http://localhost:8787/mcp bun start:mcp

# Filter by model or eval
bun start:mcp --model "Sonnet" --eval "organizations" --debug
```

Tools are discovered dynamically via the MCP protocol. The system prompt is identical to the baseline runner.

## Coding Style & Naming Conventions
All source files are TypeScript ESNext modules managed by Biome; rely on `bun run lint:fix` to enforce single quotes, trailing commas, and import sorting. Respect the `@/*` path alias defined in `tsconfig.json`, and prefer top-level async functions with explicit `Promise` return types. Export plain objects for registries (`providers`, `graders`, `reporters`) and keep filenames lowercase with hyphens to match existing patterns (`main.ts`, `file.ts`).

## Testing Guidelines
Each evaluation’s `graders.ts` must export a `graders` object keyed by descriptive test names; ensure grader functions are idempotent and return booleans. When adding new graders, run `bun start` to validate the full suite and `bun run start:eval <path>` to iterate quickly. Include human-readable acceptance criteria in `PROMPT.md`, and update or add fixtures when graders parse structured output.

## Commit & Pull Request Guidelines
Follow the existing history’s imperative style with concise subjects and optional PR references, e.g., `add webhook grader (#23)`. Group related updates into a single commit, and re-run `bun run lint` plus the relevant evaluation commands before opening a PR. Provide pull requests with a short summary, linked issues, and sample score output or debug logs whenever behavior changes.
