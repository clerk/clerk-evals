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

Append an entry in `src/index.ts` under `evaluations`:

```ts
{
  framework: 'Next.js',
  category: 'Waitlist',
  path: 'evals/waitlist',
}
```

## 5) Run and iterate

- Run all: `bun start`
- Run one: `bun run start:eval src/evals/waitlist`
- Debug artifacts: add `--debug` to write prompts, responses, and grader decisions under `debug-runs/`.

## 6) Style and checks

- Use TypeScript ESNext and the `@/*` path alias (see `tsconfig.json`).
- Format/lint before commit: `bun run lint:fix`.

That’s it—your evaluation is ready to score models.
