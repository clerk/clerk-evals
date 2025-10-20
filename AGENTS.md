# Repository Guidelines

## Project Structure & Module Organization
- Core source is in `src/`; `src/index.ts` registers models and kicks off worker execution.
- Evaluation suites live at `src/evals/<slug>/` with `PROMPT.md`, and `graders.ts`
- Shared utilities live in `src/utils/`; providers in `src/providers/`; reporters in `src/reporters/`; runners in `src/runners/`; contracts in `src/interfaces/`.
- Keep diagrams or architecture notes in `docs/`. Use the repo-level `@/` alias instead of deep relative imports.

## Build, Test, and Development Commands
- `bun i` installs dependencies; rerun after pulling integration changes.
- `bun run start` executes every enabled evaluation, printing a summary and writing `scores.json` (gitignored).
- `bun run start:eval evals/002-apiroutes` runs a single suite; swap the slug while iterating.
- `bun run start --debug` surfaces grader payloads; combine with `start:eval` for focused troubleshooting.

## Coding Style & Naming Conventions
- Write Bun-flavoured TypeScript with two-space indentation, double quotes, and named exports.
- Name evaluation folders for the domain under test (e.g. `002-apiroutes`).
- Grader helpers should be async booleans with descriptive verbs such as `passesRequiresAuth`.
- Prefer concise `@/…` imports instead of long relative paths.

## Testing Guidelines
- Evaluations are the acceptance tests; there is no separate unit harness.
- Run `bun run start` before every PR and rerun touched suites with `start:eval`.
- Ship new behaviour with updated graders or a fresh suite documenting expectations in `PROMPT.md`.
- Treat regressions as blockers; document intentional deltas in PR notes.

## Commit & Pull Request Guidelines
- Use concise imperative commits (e.g. `add webhook suite`), appending issue references in parentheses when relevant.
- PRs need a one-paragraph summary, bullet-pointed test evidence (scores or command output), linked issues, and screenshots for UI changes.
- Call out required environment variables and any post-merge steps contributors must run.

## Environment & Configuration
- Copy `.env.example` to `.env` and populate provider keys; never commit secrets.
- Update the `models` array in `src/index.ts` when adding providers or models.
- `src/reporters/file.ts` writes `scores.json` for local inspection; keep it untracked.
