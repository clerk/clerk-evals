# Repository Guidelines

## Project Structure & Module Organization
`src/index.ts` wires providers, runners, reporters, and every folder under `src/evals`. Keep each evaluation in its own directory with `PROMPT.md`, `graders.ts`, and any fixtures it needs; prefer zero-padded numeric prefixes such as `src/evals/004-new-eval` for ordered suites. Runner logic lives in `src/runners`, shared provider clients in `src/providers`, scoring helpers in `src/scorers`, and reusable utilities in `src/utils`. Diagrams intended for contributor onboarding belong in `docs/`, while transient artifacts like `scores.json` stay gitignored at the root.

## Environment Setup & Secrets
This project requires Bun `>=1.3.0`. Install dependencies with `bun install`, then copy `.env.example` to `.env` and populate `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, and `VERCEL_API_KEY`. Avoid checking secrets into version control; reference them through `process.env` only.

## Build, Test, and Development Commands
`bun start` runs the full evaluation suite and writes reporter output to the console and `scores.json`. Target a single evaluation with `bun run start:eval src/evals/002-apiroutes`, and add `--debug` to capture prompts, responses, and grader decisions. Use `bun run runner:main` for quick smoke tests of the main runner implementation. Lint and format with `bun run lint`, `bun run lint:fix`, and `bun run format`; `bun run check` applies Biome’s autofixes and unsafe rules when you need a full cleanup.

## Coding Style & Naming Conventions
All source files are TypeScript ESNext modules managed by Biome; rely on `bun run lint:fix` to enforce single quotes, trailing commas, and import sorting. Respect the `@/*` path alias defined in `tsconfig.json`, and prefer top-level async functions with explicit `Promise` return types. Export plain objects for registries (`providers`, `graders`, `reporters`) and keep filenames lowercase with hyphens to match existing patterns (`main.ts`, `file.ts`).

## Testing Guidelines
Each evaluation’s `graders.ts` must export a `graders` object keyed by descriptive test names; ensure grader functions are idempotent and return booleans. When adding new graders, run `bun start` to validate the full suite and `bun run start:eval <path>` to iterate quickly. Include human-readable acceptance criteria in `PROMPT.md`, and update or add fixtures when graders parse structured output.

## Commit & Pull Request Guidelines
Follow the existing history’s imperative style with concise subjects and optional PR references, e.g., `add webhook grader (#23)`. Group related updates into a single commit, and re-run `bun run lint` plus the relevant evaluation commands before opening a PR. Provide pull requests with a short summary, linked issues, and sample score output or debug logs whenever behavior changes.
