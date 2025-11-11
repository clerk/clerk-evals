# openfort-evals

This repository hosts public evaluation suites used to test how LLMs perform at writing Openfort code (primarily with React and Next.js). Openfort provides embedded wallet infrastructure, authentication, and blockchain integration. If an AI contributor is asked to "create a new eval suite for embedded wallet creation", it should add a new folder under `src/evals/` with a `PROMPT.md` and `graders.ts`, then register it in `src/index.ts`.

![diagram](./docs/diagram.jpg)

## Quickstart

Install [Bun](https://bun.sh) `>=1.3.0`, then gather the required API keys. See [`.env.example`](./.env.example)

```bash
cp .env.example .env
```

Run the eval suite

```bash
bun i
bun start
```

## Add a new evaluation

For detailed, copy-pastable steps see [`docs/ADDING_EVALS.md`](./docs/ADDING_EVALS.md). In short:

- Create `src/evals/your-eval/` with `PROMPT.md` and `graders.ts`.
- Implement graders that return booleans using `defineGraders(...)` and shared judges in `@/src/graders/catalog`.
- Append an entry to the `evaluations` array in `src/index.ts` with `framework`, `category`, and `path` (e.g., `evals/embedded-wallets`).
- Run `bun run start:eval src/evals/your-eval` (optionally `--debug`).

<details>
<summary>Example scores</summary>

```json
[
  {
    "model": "gpt-5-chat-latest",
    "framework": "React",
    "category": "Fundamentals",
    "value": 0.6666666666666666,
    "updatedAt": "2025-10-15T17:51:27.901Z"
  },
  {
    "model": "gpt-4o",
    "framework": "React",
    "category": "Fundamentals",
    "value": 0.3333333333333333,
    "updatedAt": "2025-10-15T17:51:30.871Z"
  },
  {
    "model": "claude-sonnet-4-0",
    "framework": "React",
    "category": "Fundamentals",
    "value": 0.5,
    "updatedAt": "2025-10-15T17:51:56.370Z"
  },
  {
    "model": "claude-sonnet-4-5",
    "framework": "React",
    "category": "Fundamentals",
    "value": 0.8333333333333334,
    "updatedAt": "2025-10-15T17:52:03.349Z"
  },
  {
    "model": "v0-1.5-md",
    "framework": "React",
    "category": "Fundamentals",
    "value": 1,
    "updatedAt": "2025-10-15T17:52:06.700Z"
  },
  {
    "model": "claude-opus-4-0",
    "framework": "React",
    "category": "Fundamentals",
    "value": 0.5,
    "updatedAt": "2025-10-15T17:52:06.898Z"
  },
  {
    "model": "gpt-5",
    "framework": "React",
    "category": "Fundamentals",
    "value": 0.5,
    "updatedAt": "2025-10-15T17:52:07.038Z"
  }
]
```

</details>

**Debuging**

```bash
# Run a single evaluation
bun run start:eval evals/apiroutes

# Run in debug mode
bun run start --debug

# Run a single evaluation in debug mode
bun run start:eval evals/apiroutes --debug
```

## Overview

This project is broken up into a few core pieces:

- [`src/index.ts`](./src/index.ts): This is the main entrypoint of the project. Evaluations, models, reporters, and the runner are registered here, and all executed.
- [`/evals`](./src/evals): Folders that contain a prompt and grading expectations. Runners currently assume that eval folders contain two files: `graders.ts` and `PROMPT.md`.
- [`/runners`](./src/runners): The primary logic responsible for loading evaluations, calling provider llms, and outputting scores.
- [`/reporters`](./src/reporters): The primary logic responsible for sending scores somewhere — stdout, a file, etc.

### Running

A **runner** takes a simple object as an argument:

```jsonc
{
  "provider": "openai",
  "model": "gpt-5",
  "evalPath": "/absolute/path/to/openfort-evals/src/evals/basic-setup
}
```

It will resolve the provider and model to the respective SDK.

It will load the designated **evaluation**, generate LLM text from the prompt, and pass the result to graders.

### Evaluations

At the moment, **evaluations** are simply folders that contain:

- `PROMPT.md`: the instruction for which we're evaluating the model's output on
- `graders.ts`: a module containing grader functions which return `true/false` signalling if the model's output passed or failed. This is essentially our acceptance criteria.

### Graders

Shared grader primitives live in [`src/graders/index.ts`](./src/graders/index.ts). Use them to declare new checks with a consistent, terse shape:

```ts
import { contains, defineGraders, judge } from '@/src/graders'
import { llmChecks } from '@/src/graders/catalog'

export const graders = defineGraders({
  references_providers: contains('providers.tsx'),
  package_json: llmChecks.packageJsonOpenfortVersion,
  openfort_setup: judge(
    'Does the answer correctly set up OpenfortProvider with publishableKey and walletConfig?',
  ),
})
```

- `contains` / `containsAny`: case-insensitive substring checks by default
- `matches`: regex checks
- `judge`: thin wrappers around the LLM-as-judge scorer. Shared prompts live in [`src/graders/catalog.ts`](./src/graders/catalog.ts); add new reusable prompts there.
- `defineGraders`: preserves type inference for the exported `graders` record.

### Score

For a given model, and evaluation, we'll retrieve a score from `0..1`, which is the percentage of grader functions that passed.

### Reporting

At the moment, we employ two minimal **reporters**

- [console](./src/reporters/console.ts): writes scores via `console.log()`
- [file](./src/reporters/file.ts): saves scores to a gitignored `scores.json` file.

### Interfaces

For the notable interfaces, see [`/interfaces`](./src/interfaces/index.ts).
