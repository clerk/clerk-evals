# Adding a new evaluation

This repository evaluates how well LLMs write Clerk code. Follow this checklist when you add a new evaluation.

## 1) Create the folder

- Choose a concise, descriptive slug, e.g. `src/evals/waitlist/` (no numeric prefix).
- Each direct evaluation folder contains two required files:
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

Prefer deterministic graders for file paths, imports, API calls, and control flow. Use a judge only when code checks cannot express the requirement.

Direct evaluations inspect structured code responses. They do not compile or run the generated project. Add an agent fixture when compilation or runtime behavior is a required result.

## 4) Add a grader contract

Add one accepted response and plausible wrong responses when a task uses deterministic graders:

```text
grader-contract/
  accepted/reference.md
  rejected/missing-authorization.md
graders.test.ts
```

An accepted fixture must pass every grader. Each rejected fixture has a `fail` list in YAML frontmatter. Every grader that is not in that list must still pass. This rule prevents a weak negative fixture from hiding false positives.

Run the contract with:

```bash
bun run grader:contract --eval waitlist
```

## 5) Register the evaluation

Append an entry in `src/config/evaluations.ts`:

```ts
{
  framework: 'Next.js',
  category: 'Waitlist',
  path: 'evals/waitlist',
}
```

## 6) Add an agent fixture when repository work matters

Agent evaluations need a complete repository. Put the repository and its hidden Bun tests in separate directories:

```text
agent/
  workspace/
    package.json
    tsconfig.json
    app/
  hidden-tests/
    behavior.test.ts
```

Register the workspace and hidden tests with eval-relative paths:

```ts
{
  framework: 'Next.js',
  category: 'Waitlist',
  path: 'evals/waitlist',
  agent: {
    workspacePath: 'agent/workspace',
    verification: { testsPath: 'agent/hidden-tests' },
  },
}
```

The harness copies only `workspace` before the coding agent starts. It stages the hidden tests outside that workspace after the agent exits. A hidden test failure sets the task score to zero. A passing hidden test does not add score weight.

Hidden tests must check runtime behavior. They can mock external services and import files from `process.env.CLERK_EVAL_WORKSPACE`, which is the final agent workspace. Do not put grader answers or test files in the workspace fixture.

## 7) Run and iterate

- Smoke test: `bun start --eval "waitlist" --smoke --debug`
- Run all: `bun start`
- Debug mode: add `--debug` to collect detailed runner output while recording the run in SQLite.

## 8) Style and checks

- Use TypeScript ESNext and the `@/*` path alias (see `tsconfig.json`).
- Run `bun test`, `bun run typecheck`, `bun run audit`, and `bun run lint` before commit.
- Apply formatting and safe lint fixes with `bun run lint:fix`.

The evaluation is now ready to score models.
