# Next.js setup prompt A/B experiment

## Design

This is a manual comparison, not a replacement for the add-auth baseline-vs-Skills workflow. A is `clerk-docs/prompts/nextjs-quickstart.md`; B is `clerk-docs/prompts/cli-setup.md` plus the Next.js quickstart framework hint appended by the live Docs card. The runner reads both files from **one full `clerk/clerk` commit SHA** in a local Docs checkout; the hashes record the prompt text actually sent to each agent. This avoids public raw-file access to the private repository. Neither arm starts with installed Clerk skills or an MCP server. Both receive the same setup-prompt label, non-interactive user approval, and project context.

Each arm runs on the same three starting points: an existing Next.js 15 project, an existing Next.js 16 project, and an empty directory (the user has chosen Next.js and npm). Both Claude Code and Codex run each case five times by default: **60 agent trials**. Trials alternate A/B order. Each run uses a fresh workspace and temporary home; hidden verification builds the project at the workspace root or in its single scaffolded subdirectory. Results include per-grader outcomes, token counts when the agent reports them, errors, prompt hashes, CLI version, and agent model/version. The runner saves each trial's transcript and observed commands in restricted, git-ignored `nextjs-prompt-ab-transcripts/` and records its path, including for failed runs. It records confirmed Clerk CLI provisioning failures separately from prompt failures.

## Run

Before spending credits or creating apps, pick a full Docs commit SHA that contains both prompt files. Confirm that the shared arm's `NEXTJS_QUICKSTART_HINT` matches `frameworkHint('next')` in `src/lib/prompt-framework.ts` at that commit, then check the plan:

```bash
bun ab:nextjs-prompts --docs-sha <40-character-clerk-clerk-sha> --docs-repo <path-to-local-clerk-clerk> --claude-model <model> --codex-model <model> --dry-run
```

For the real run, use the same arguments with `--acknowledge-app-creation` instead of `--dry-run`. Set `VERCEL_AI_GATEWAY_API_KEY` through the normal eval environment. You may add `--output <path>`; the default is `nextjs-prompt-ab-results.json`. The script refuses to overwrite that file. If interrupted, rerun the identical command with `--resume`; it checks prompt hashes, models, versions, and trial count before skipping finished cells. Use `--runs 1 --keep-workspaces` for the 12-trial smoke run and manual browser checks, **not** for the parity decision. Delete preserved workspaces after those checks and cleanup.

## Cleanup

These trials may create real accountless Clerk applications. Arrange a disposable test environment and a cleanup owner before running. Before deleting a workspace, the runner copies any root-level or scaffolded `.clerk/keyless.json` (CLI) and `.clerk/.tmp/keyless.json` (SDK) files to restricted, git-ignored files under `nextjs-prompt-ab-claims/` and records their paths in the result and the cumulative `claimFiles` list, including across retries. Treat these files as credentials: the cleanup owner can use each file's claim token or claim URL to claim its app into a throwaway Clerk workspace, delete the app there, then delete the claim file. The normal run deletes the local workspace and home; that **doesn't** delete remotely provisioned applications. If the Clerk CLI reports a development-key provisioning warning and no completed app evidence remains, the trial records an infrastructure error. Without that warning, a trial with missing app evidence is graded like any other completed trial. [Clerk CLI at 5967d16](https://github.com/clerk/cli/blob/5967d16fdb95c47b962ced6195156acffee2c8e8/packages/cli-core/src/commands/init/index.ts#L1008-L1013) writes the keyless file only after writing both keys succeeds, so this is an indirect provisioning check without reading the environment file. Inspect such failures before retrying. A retry can create another app; retain every claim file until its app is accounted for.

## Browser check

For each of the 12 preserved smoke workspaces, change into its Next.js project directory (the workspace itself for existing fixtures, or its single scaffolded subdirectory for the empty fixture), then run the optional browser check:

```bash
npm install --save-dev @playwright/test @clerk/testing
npx playwright install chromium
cp -R <clerk-evals-repo>/src/experiments/nextjs-prompt-ab/browser-check .clerk-eval-browser
npx playwright test --config .clerk-eval-browser/playwright.config.mjs
```

The Playwright config loads the project's own `.env.local`, so `clerkSetup()` uses that workspace's `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY`. The check verifies a visible sign-in button, then signs up a unique `+clerk_test` address with code `424242`. Record each result and test-user email alongside the automated scores, and include the users in app cleanup.

## Review results

Review the JSON by agent and fixture. The predeclared bar for a parity recommendation is that **B passes each critical check at least as often as A among the five completed trials in every agent and fixture cell**. The critical checks are `ran_clerk_init`, `appropriate_init_flags`, `correct_next_version`, `correct_middleware_file`, `provider_inside_body`, `visible_auth_controls`, `no_unrequested_account_commands`, and `hidden_functional_tests`. If A misses a check and B has the same number of passes, that check meets relative parity; it doesn't show that either prompt is reliable enough for the Docs card. Any infrastructure error makes that cell inconclusive until you rerun it. Agent timeouts count as completed failed trials, not infrastructure errors. Read the saved transcript of every failed trial and every A/B disagreement before drawing a conclusion. A lower overall average alone doesn't settle parity, and five trials per cell can't establish statistical equivalence.

Don't claim parity or delete the dedicated prompt until remote app cleanup and result review are complete. A decision to replace the card belongs in a later Docs PR; this experiment doesn't change either prompt.

## Scope and limitations

The static auth-control check alone can't prove browser rendering. The optional browser check tests that behavior in the preserved smoke workspaces. Both prompts share the bot-protection paragraph and these agents have no browser, so this A/B doesn't test bot protection. The testing token bypasses it for the browser check. The experiment tests the Next.js middleware guidance from [clerk/skills#107](https://github.com/clerk/skills/pull/107), but it doesn't test that PR's lockfile or alternate package-runner guidance: the empty fixture has no leftover lockfile and its user context chooses npm. Report these limits with the results.
