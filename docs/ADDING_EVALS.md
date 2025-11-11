# Adding a new evaluation

This repository evaluates how well LLMs write Openfort code. Follow this checklist when you add a new evaluation.

## 1) Create the folder

- Choose a concise, descriptive slug, e.g. `src/evals/embedded-wallets/` (no numeric prefix).
- Each evaluation folder contains exactly two required files:
  - `PROMPT.md`
  - `graders.ts`

## 2) Write PROMPT.md

State the task and acceptance criteria in plain English. Be explicit about the framework (React/Next.js) and Openfort expectations.

Example skeleton:

```md
# Task

Set up embedded wallet creation in a React app using Openfort.

## Acceptance criteria
- Includes `@openfort/react` installation and required dependencies
- Configures OpenfortProvider with publishableKey and walletConfig
- Sets up providers for Wagmi, TanStack Query, and Openfort
- Implements wallet creation flow
- Documents the setup steps
```

## 3) Implement graders.ts

Use shared helpers from `@/src/graders` and `@/src/graders/catalog`.

```ts
import { contains, defineGraders } from '@/src/graders'
import { llmChecks } from '@/src/graders/catalog'

export const graders = defineGraders({
  references_package: contains('@openfort/react'),
  has_wagmi: contains('wagmi'),
  has_viem: contains('viem'),
  package_version_ok: llmChecks.packageJsonOpenfortVersion,
  openfort_provider_setup: contains('OpenfortProvider'),
})
```

- Export a `graders` object.
- Keys are descriptive test names.
- Values are grader functions or registered judges; they must return `boolean`.

## 4) Register the evaluation

Append an entry in `src/index.ts` under `evaluations`:

```ts
{
  framework: 'React',
  category: 'Embedded Wallets',
  path: 'evals/embedded-wallets',
}
```

## 5) Run and iterate

- Run all: `bun start`
- Run one: `bun run start:eval src/evals/embedded-wallets`
- Debug artifacts: add `--debug` to write prompts, responses, and grader decisions under `debug-runs/`.

## 6) Style and checks

- Use TypeScript ESNext and the `@/*` path alias (see `tsconfig.json`).
- Format/lint before commit: `bun run lint:fix`.

That’s it—your evaluation is ready to score models.
