# Adding a new evaluation

This repository evaluates how well LLMs write Openfort code. Follow this checklist when you add a new evaluation.

## 1) Create the folder

- Choose a concise, descriptive slug, e.g. `src/evals/wallets/create/` (no numeric prefix).
- Each evaluation folder contains exactly two required files:
  - `PROMPT.md`
  - `graders.ts`

## 2) Write PROMPT.md

State the task and acceptance criteria in plain English. Be explicit about the framework (Next.js) and Openfort expectations.

Example skeleton:

```md
# Task

Build a Next.js app that creates an embedded wallet using the Openfort SDK and sends a sponsored transaction.

## Acceptance criteria
- Includes `@openfort/openfort-node` installation and env setup
- Initializes Openfort with the secret key
- Creates an embedded wallet for the authenticated user
- Sends a sponsored transaction using a policy
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

Append an entry in `src/config/evaluations.ts`:

```ts
{
  framework: 'Next.js',
  category: 'Embedded Wallets',
  path: 'evals/wallets/create',
}
```

## 5) Run and iterate

- Run all: `bun start`
- Run one: `bun start --eval wallets/create`
- Debug artifacts: add `--debug` to write prompts, responses, and grader decisions under `debug-runs/`.

## 6) Style and checks

- Use TypeScript ESNext and the `@/*` path alias (see `tsconfig.json`).
- Format/lint before commit: `bun run lint:fix`.

That's it—your evaluation is ready to score models.
