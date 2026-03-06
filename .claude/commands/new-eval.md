---
description: Create a new Clerk eval from docs URL or feature description
argument-hint: <clerk-docs-url-or-description>
allowed-tools: Read, Write, Bash(mkdir:*), Glob, WebFetch
---

# Create New Clerk Eval

Create a new evaluation for the clerk-evals suite based on Clerk documentation or a feature description.

## Input

`$ARGUMENTS` = Either:
- A Clerk docs URL (e.g., `https://clerk.com/docs/components/user-button`)
- A feature description (e.g., "customize SignIn with dark theme and custom logo")

## Your Task

### Step 1: Analyze the Input

If URL provided:
- Fetch the docs page using WebFetch
- Extract the core feature/component being documented
- Identify the key use cases and configuration options

If description provided:
- Parse the feature request
- Identify which Clerk component/feature it relates to

### Step 2: Propose the Eval (STOP HERE FOR CONFIRMATION)

Present a summary to the user:

```
Based on the input, I propose:

Category: <category>
Slug: <kebab-case-name>
Focus: <1-2 sentence description of what this eval tests>

PROMPT.md will test:
- <key capability 1>
- <key capability 2>

Graders will check:
- <grader 1>
- <grader 2>

Proceed? (y/n)
```

**DO NOT create any files until the user confirms.**

### Step 3: Create the Eval (after confirmation)

1. **Create directory**: `src/evals/<category>/<slug>/`

2. **Create PROMPT.md**:
   - Start with `# Task`
   - One or two sentences describing WHAT to build, not HOW
   - Focus on the use case and desired outcome
   - Don't list implementation details (no prop names, no file paths)
   - Reference style: @src/evals/ui-components/sign-in-customization/PROMPT.md

3. **Create graders.ts**:
   - Import from `@/src/graders` and `@/src/graders/catalog`
   - Use `defineGraders()` to export
   - Start from template: `src/evals/_template/graders.ts`
   - Reference: @src/evals/ui-components/sign-in-customization/graders.ts

   **Grader Best Practices** (prefer code over judges):

   Available primitives (from `@/src/graders`):
   - `contains(needle)` — case-insensitive substring match
   - `containsAny(needles[])` — match any substring
   - `containsAll(needles[])` — match all substrings
   - `matches(regex)` — regex test
   - `not(grader)` — negate a grader
   - `all(...graders)` — AND composition
   - `any(...graders)` — OR composition
   - `judge(criteria)` — LLM judge (last resort)

   Catalog (from `@/src/graders/catalog`):
   - `llmChecks.packageJsonClerkVersion` — checks @clerk/nextjs >= 6.0.0
   - `llmChecks.environmentVariables` — checks .env.local has CLERK keys
   - `authUIChecks.*` — SignIn, SignUp, UserButton, SignedIn, SignedOut
   - `uiComponentChecks.*` — appearance, variables, elements, layout
   - `organizationsUIChecks.*` — OrgSwitcher, OrgProfile, OrgList
   - `quickstartChecks.*` — clerkMiddleware, ClerkProvider, no deprecated

   **When to use `judge()` vs code graders**:
   - Use code graders when checking string presence/absence: `contains('middleware.ts')`, `not(contains('authMiddleware'))`
   - Use composites for multi-condition checks: `all(contains('await auth()'), contains('orgSlug'))`
   - Only use `judge()` when criteria requires semantic understanding (logic flow, data relationships, ordering)
   - Each `judge()` call costs ~$0.003 and introduces non-determinism — avoid when possible

   **Examples**:
   ```typescript
   // GOOD: deterministic code graders
   middleware_file: contains('middleware.ts'),
   no_deprecated: not(contains('authMiddleware')),
   auth_with_org: all(contains('await auth()'), contains('orgSlug')),
   uses_any_pm: containsAny(['npm', 'bun', 'yarn', 'pnpm']),
   has_id_field: matches(/\.id\b/),

   // OK: judge for semantic checks only
   correct_flow: judge('Does the solution call checkout.confirm before checkout.finalize?'),
   ```

4. **Register** in `src/config/evaluations.ts`:
   ```typescript
   { framework: 'Next.js', category: '<Category>', path: 'evals/<category>/<slug>' },
   ```

5. **Run lint**: `bun run check`

## Categories

| Category | Slug | Framework | Focus |
|----------|------|-----------|-------|
| Quickstarts | `quickstarts` | Next.js, React, iOS | Initial setup, hello world |
| Auth | `auth` | Next.js | Sign in/up, route protection, middleware |
| User Management | `user-management` | Next.js | currentUser, useUser, profiles, metadata |
| UI Components | `ui-components` | Next.js | Component customization, appearance API |
| Organizations | `organizations` | Next.js | Multi-tenancy, teams, org switching |
| Webhooks | `webhooks` | Next.js | Event handling, Svix verification |
| Billing | `billing` | Next.js | Checkout, subscriptions, payments |
| Upgrades | `upgrades` | Next.js | SDK migration (Core 2 -> Core 3) |

## Output

After creating the eval, show:
1. The created PROMPT.md content
2. The created graders.ts content
3. The updated line in evaluations.ts
4. Suggested verification: `bun start --eval "<slug>" --model "claude-opus-4-6" --smoke --debug`
