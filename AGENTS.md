# Repository Guidelines

## Project Structure & Module Organization

Source lives in `src/`, with `src/index.ts` orchestrating model registration and
worker execution. Evaluation suites sit under `src/evals/<slug>/` and should
include `PROMPT.md`, `graders.ts`, and an optional `config.json` to toggle
availability. Execution helpers live in `src/runners/`, integrations in
`src/providers/`, reporters in `src/reporters/`, and shared contracts in
`src/interfaces/`. Keep architecture notes or diagrams in `docs/`, and use the
repo-level path alias `@/` (see `tsconfig.json`) instead of long relative imports.

## Build, Test, and Development Commands

- `bun i` – install dependencies; run after pulling new provider integrations.
- `bun run start` – execute every enabled evaluation; outputs summaries to
stdout and `scores.json` (gitignored).
- `bun run start:eval evals/002-apiroutes` – target a single suite when
iterating on graders or prompts.
- `bun run start --debug` – surface grader payloads for troubleshooting; combine
with `start:eval` for focused runs.

## Coding Style & Naming Conventions

Write modern TypeScript using Bun’s ESM runtime. Follow the existing pattern of
two-space indentation, double quotes, and named exports. Name evaluation folders
after the general domain they're testing, and keep shared utilities in
`src/utils/`. When authoring graders, export async functions that return
booleans and prefer descriptive names such as `passesRequiresAuth`.

## Testing Guidelines

There is no standalone unit-test harness; evaluation runs are the authoritative
acceptance test. Before opening a PR, run `bun run start` and, if you touched a
specific suite, rerun it with `start:eval` to confirm the score deltas. New
features should ship with either updated graders or a fresh evaluation folder
documenting the expected behaviour in `PROMPT.md`. Treat zero regressions as the
target—capture any intentional changes in the PR notes.

## Commit & Pull Request Guidelines

Use concise, imperative commit messages (`add webhook suite`,
`fix relative import paths`) and append issue references in parentheses where
relevant, mirroring the current history. Pull requests should include: a
one-paragraph summary, bullet-pointed testing evidence
(scores or command output), linked issues, and screenshots when UI results
change. Flag required environment variables and mention any follow-up actions
contributors must run post-merge.

## Environment & Configuration

Copy `.env.example` to `.env` and fill in API keys for each provider you
exercise; never commit secrets. `src/reporters/file.ts` writes aggregate results
to `scores.json`, so inspect that file locally but leave it untracked. When
adding providers or models, update the `models` array in `src/index.ts` and
document credential prerequisites in your PR.
