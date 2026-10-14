# Next.js setup prompt A/B experiment (DOCS-12247)

This is a manual comparison, not a replacement for the add-auth baseline-vs-Skills workflow. A is `clerk-docs/prompts/nextjs-quickstart.md`; B is `clerk-docs/prompts/cli-setup.md`. Both files are read from **one full `clerk/clerk` commit SHA** in a local Docs checkout and their content hashes are recorded. This avoids public raw-file access to the private repository. No installed Clerk skills or MCP server is given to either arm. Both receive the same non-interactive user approval and project context.

Each arm runs on the same three starting points: an existing Next.js 15 project, an existing Next.js 16 project, and an empty directory (the user has chosen Next.js and npm). Both Claude Code and Codex run each case five times by default: **60 agent trials**. Trials alternate A/B order. Each run uses a fresh workspace and temporary home; hidden verification runs `npm run build`. Results include per-grader outcomes, errors, prompt hashes, CLI version, and agent model/version. An infrastructure error is recorded separately from a prompt failure.

Before spending credits or creating apps, pick a full Docs commit SHA that contains both prompt files and check the plan:

```bash
bun ab:nextjs-prompts --docs-sha <40-character-clerk-clerk-sha> --docs-repo <path-to-local-clerk-clerk> --claude-model <model> --codex-model <model> --dry-run
```

For the real run, use the same arguments with `--acknowledge-app-creation` instead of `--dry-run`. Set `VERCEL_AI_GATEWAY_API_KEY` through the normal eval environment. You may add `--output <path>`; the default is `nextjs-prompt-ab-results.json`. The script refuses to overwrite that file. If interrupted, rerun the identical command with `--resume`; it checks prompt hashes, models, versions, and trial count before skipping finished cells. Use `--runs 1` only for a smoke run, **not** for the parity decision.

These trials may create real accountless Clerk applications. Arrange a disposable test environment and a cleanup owner before running. The local workspace and home are deleted after each run, but that does **not** delete remotely provisioned applications. Do not claim parity or delete the dedicated prompt until remote app cleanup and the result review are complete.

Review the JSON by agent and fixture. Inspect `correct_middleware_file`, `provider_inside_body`, `visible_auth_controls`, `appropriate_init_flags`, `hidden_functional_tests`, and errors (including timeouts or bot-protection stalls). The static auth-control check cannot prove browser rendering, so inspect that behavior in a representative completed workspace or a separate safe browser run. B must match A across the important checks, not merely have a similar overall average. A decision to replace the card belongs in a later Docs PR; this experiment does not change either prompt.
