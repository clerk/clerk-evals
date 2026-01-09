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
   - Primitives: `contains()`, `containsAny()`, `matches()`, `judge()`
   - Catalog: `llmChecks.*`, `authUIChecks.*`, `uiComponentChecks.*`, `organizationsUIChecks.*`, `billingUIChecks.*`
   - Reference: @src/evals/ui-components/sign-in-customization/graders.ts

4. **Register** in `src/config/evaluations.ts`

5. **Run lint**: `bun run check`

## Categories

| Category | Slug | Focus |
|----------|------|-------|
| Auth | `auth` | Sign in/up, route protection, middleware |
| User Management | `user-management` | currentUser, useUser, profiles, metadata |
| UI Components | `ui-components` | Component customization, appearance API |
| Organizations | `organizations` | Multi-tenancy, teams, org switching |
| Webhooks | `webhooks` | Event handling, Svix verification |
| Billing | `billing` | Checkout, subscriptions, payments |

## Output

After creating the eval, show:
1. The created PROMPT.md content
2. The created graders.ts content
3. The updated line in evaluations.ts
