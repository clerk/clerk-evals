# Adding a new evaluation

This repository evaluates how well LLMs write Clerk code. Follow this checklist when you add a new evaluation.

## 1) Create the folder

- Choose a concise, descriptive slug, e.g. `src/evals/waitlist/` (no numeric prefix).
- Each evaluation folder contains exactly two required files:
  - `PROMPT.md`
  - `graders.ts`

## 2) Write PROMPT.md

State the task and acceptance criteria in plain English. Be explicit about the framework (Next.js) and Clerk expectations.

Example skeleton:

```md
# Task

Build a Waitlist feature in a Next.js app using Clerk.

## Acceptance criteria
- Includes `@clerk/nextjs` installation and env setup
- Implements a protected API route to submit waitlist entries
- Stores entries and returns appropriate responses
- Documents the flow briefly
```

## 3) Implement graders.ts

Use shared helpers from `@/src/graders` and `@/src/graders/catalog`.

```ts
import { contains, defineGraders } from '@/src/graders'
import { llmChecks } from '@/src/graders/catalog'

export const graders = defineGraders({
  references_package: contains('@clerk/nextjs'),
  env_vars_present: llmChecks.environmentVariables,
  package_version_ok: llmChecks.packageJsonClerkVersion,
  describes_waitlist_api: contains('/api/waitlist'),
})
```

- Export a `graders` object.
- Keys are descriptive test names.
- Values are grader functions or registered judges; they must return `boolean`.

## 4) Register the evaluation

Append an entry in `src/config/evaluations.ts` with metadata:

```ts
{
  framework: 'Next.js',
  category: 'Waitlist',
  path: 'evals/waitlist',
  description: 'Implements a protected waitlist API route with Clerk auth, env setup, and entry storage',
  primaryCapability: 'api_knowledge',
  capabilities: ['webhook_integration'],  // optional secondary tags
  source: 'coverage',
}
```

### Metadata fields

| Field | Required | Description |
|-------|----------|-------------|
| `description` | Yes | One-line summary of what behavior this eval measures. Start with a verb. |
| `primaryCapability` | Yes | The single capability this eval primarily tests. Ask: "what is the hardest thing this eval asks the model to do?" |
| `capabilities` | No | Additional secondary tags for filtering. Keep sparse — most evals need 0-1 secondary tags. |
| `source` | No | Why this eval was created: `coverage` (fill a gap), `regression` (caught a bug), `dogfooding` (real user scenario), `manual` (manually authored). |

### Choosing the primary capability

Pick ONE — the behavior that makes this eval hard:

- `api_knowledge` — tests knowledge of current Clerk API surface (imports, hooks, helpers)
- `framework_detection` — requires correctly identifying the project framework before acting
- `migration_reasoning` — involves understanding breaking changes and upgrade paths
- `negative_constraint` — primarily checks the model avoids wrong or deprecated patterns
- `tool_composition` — needs multiple MCP tool calls in sequence
- `ui_composition` — assembles Clerk UI components with correct props and composition
- `webhook_integration` — sets up event-driven webhook flows with signature verification

## 5) Run and iterate

- Smoke test: `bun start --eval "waitlist" --smoke --debug`
- Run all: `bun start`
- Debug artifacts: add `--debug` to write prompts, responses, and grader decisions under `debug-runs/`.

## 6) Style and checks

- Use TypeScript ESNext and the `@/*` path alias (see `tsconfig.json`).
- Format/lint before commit: `bun run lint:fix`.

That’s it—your evaluation is ready to score models.
