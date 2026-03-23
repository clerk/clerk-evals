# Framework-Agnostic "Add Auth" Agent Eval

## Summary

A single universal prompt ("Add Clerk Authentication") evaluated across multiple framework environments (Next.js, React, Android, iOS). Unlike existing evals that test LLM API text responses, this eval runs exclusively in agent mode — the agent operates inside a realistic project scaffold and produces code via tool calls.

The eval uses **fixtures** (minimal project scaffolds) to simulate each framework environment, a **shared prompt**, and **per-variant graders** that reuse existing shared checks from the catalog.

## Motivation

The existing eval suite has separate prompts per framework. This eval tests a different — and arguably more realistic — scenario: a single framework-agnostic instruction given to an agent that must detect the project type and act accordingly. This matches how developers actually use coding agents (they say "add auth" in their project, not "add auth to a Next.js app").

## Eval Directory Layout

```
src/evals/add-auth/
  PROMPT.md                                    # Universal prompt (shared)
  fixtures/
    nextjs/
      package.json                             # next 15.x, react 19.x
      app/layout.tsx                           # Bare root layout
    react/
      package.json                             # react 19.x, vite 6.x
      index.html                               # Vite entry point
      src/main.tsx                             # Bare React mount
    android/
      build.gradle.kts                         # Compose + Kotlin deps
      app/src/main/AndroidManifest.xml
      app/src/main/java/.../MainActivity.kt   # Bare Compose activity
    ios/
      Package.swift                            # SwiftUI dependency
      Sources/MyApp/MyApp.swift               # Bare SwiftUI App struct
  graders/
    nextjs.ts
    react.ts
    android.ts
    ios.ts
```

Fixtures are intentionally minimal — just enough for framework detection and realistic file paths for the agent to write into.

## PROMPT.md Content

The prompt is the user's framework-agnostic "Add Clerk Authentication" prompt. It instructs the agent to:
1. Read `package.json` to detect the framework
2. Fetch and follow the official quickstart for the detected framework
3. Use Keyless mode by default
4. Detect and integrate with shadcn/ui if present

The prompt contains no framework-specific hints — the agent must infer the framework from the fixtures.

## Interface Changes

### `Category` type (`src/interfaces/index.ts`)

Add `'Add Auth'` to the `Category` union:

```ts
export type Category =
  | 'Quickstarts'
  | 'Auth'
  // ...existing...
  | 'Add Auth'
```

### `Evaluation` type (`src/interfaces/index.ts`)

Add optional `variant` field:

```ts
export type Evaluation = {
  framework: Framework
  category: Category
  path: string
  /** Variant subdirectory for fixture-based evals (e.g., 'nextjs', 'android') */
  variant?: string
}
```

### `AgentRunnerArgs` type (`src/interfaces/agent.ts`)

Add optional `fixturesPath` and `gradersPath` fields:

```ts
export type AgentRunnerArgs = {
  // ...existing fields...
  /** Path to fixtures directory to copy into work dir before execution */
  fixturesPath?: string
  /** Full path to the variant grader file (e.g., .../graders/nextjs.ts) */
  gradersPath?: string
}
```

## Registry Entries

In `src/config/evaluations.ts`:

```ts
// Add Auth — framework-agnostic agent eval (4 variants, shared prompt)
{ framework: 'Next.js', category: 'Add Auth', path: 'evals/add-auth', variant: 'nextjs' },
{ framework: 'React', category: 'Add Auth', path: 'evals/add-auth', variant: 'react' },
{ framework: 'Android', category: 'Add Auth', path: 'evals/add-auth', variant: 'android' },
{ framework: 'iOS', category: 'Add Auth', path: 'evals/add-auth', variant: 'ios' },
```

**Baseline runner behavior:** These evals share the path `evals/add-auth` which has no root-level `graders.ts`. The baseline runner (`bun start`) will error when trying to import the graders file. These errors are reported per-eval and do not crash the suite, matching the "fail naturally" design decision.

**Eval filtering:** Running `--eval add-auth` matches all four variants since they share the same path. There is no way to filter to a single variant with the current filter logic — this is acceptable since the variants are fast and always run together.

## Runner Changes

### `src/runners/agents/shared.ts`

New `copyFixtures` function:

```ts
export async function copyFixtures(workDir: string, fixturesPath: string): Promise<void> {
  await fs.cp(fixturesPath, workDir, { recursive: true, force: true })
}
```

Uses `force: true` to avoid conflicts with files created by MCP config or skills setup. Fixtures must be copied **first** (before `createTempMCPConfig` and `setupSkills`) so that other setup steps can overlay on top of the fixture project.

### `src/runners/agents/claude-code.ts`

The `exec` function destructures the new fields from `AgentRunnerArgs`:

```ts
export default async function exec({
  evalPath,
  debug = false,
  mcpConfig,
  skillsConfig,
  timeout = DEFAULT_AGENT_TIMEOUT,
  executablePath,
  envPath,
  fixturesPath,   // NEW
  gradersPath,     // NEW
}: AgentRunnerArgs): Promise<RunnerResult> {
```

After creating the temp work dir and **before** MCP/skills setup:

```ts
// Copy fixtures into work dir (must happen before MCP/skills setup)
if (fixturesPath) {
  await copyFixtures(workDir, fixturesPath)
}
```

For grader loading, use `gradersPath` when provided instead of the default `evalPath`:

```ts
const gradersModule = gradersPath
  ? (await import(gradersPath)) as { graders: Graders }
  : (await import(path.join(evalPath, 'graders.ts'))) as { graders: Graders }
const graders = gradersModule.graders
```

This avoids modifying the shared `loadGraders` function — the variant-aware logic stays contained in the agent runner.

### `src/agent-index.ts`

When building tasks, resolve the full fixture and grader paths from the variant:

```ts
const tasks = filteredEvaluations.map((evaluation) => ({
  // ...existing fields...
  fixturesPath: evaluation.variant
    ? path.join(process.cwd(), 'src', evaluation.path, 'fixtures', evaluation.variant)
    : undefined,
  gradersPath: evaluation.variant
    ? path.join(process.cwd(), 'src', evaluation.path, 'graders', `${evaluation.variant}.ts`)
    : undefined,
}))
```

And when constructing `runnerArgs: AgentRunnerArgs`, include the new fields:

```ts
const runnerArgs: AgentRunnerArgs = {
  // ...existing fields...
  fixturesPath: task.fixturesPath,
  gradersPath: task.gradersPath,
}
```

## Grader Design

Each variant grader is a standalone file importing from `@/src/graders` primitives and `@/src/graders/catalog` where applicable. The catalog contains Next.js-specific shared checks (`quickstartChecks`, `authUIChecks`, `llmChecks`); React, Android, and iOS graders compose checks from primitives (`contains`, `containsAny`, `not`, `judge`).

### `graders/nextjs.ts`

Reuses from `quickstartChecks`, `authUIChecks`, `llmChecks` catalog:
- `clerkMiddleware` usage and import from `@clerk/nextjs/server`
- `ClerkProvider` wrapping the app
- `@clerk/nextjs` package reference
- Environment variables (publishable key, secret key)
- No deprecated patterns (`authMiddleware`, `_app.tsx`, pages router)
- UI components (`SignedIn`/`SignedOut`, `UserButton`)

### `graders/react.ts`

Composes checks from primitives (patterns from `src/evals/quickstarts/react-vite/graders.ts`):
- `@clerk/clerk-react` package
- `ClerkProvider` in main file with `publishableKey` prop
- Vite environment variable (`VITE_CLERK_PUBLISHABLE_KEY`)
- UI components (`SignedIn`, `SignedOut`, `SignInButton`, `UserButton`)
- No deprecated patterns (`frontendApi`, `REACT_APP_`)

### `graders/android.ts`

Composes checks from primitives (patterns from `src/evals/android/prebuilt-setup/graders.ts`):
- `clerk-android-ui` package
- `AuthView` and `UserButton` components
- `Clerk.initialize()` in Application class (LLM judge)
- INTERNET permission in manifest
- Publishable key wiring
- No custom sign-in form logic alongside prebuilt

### `graders/ios.ts`

Composes checks from primitives (patterns from `src/evals/ios/prebuilt-setup/graders.ts`):
- `clerk-ios` package
- `ClerkKit` and `ClerkKitUI` imports
- `AuthView` component
- Publishable key configuration

## What This Does NOT Change

- Existing evals are unaffected — no changes to their structure or graders
- The shared `loadGraders` in `src/runners/shared.ts` is unchanged
- The baseline LLM runner (`bun start`) is unchanged (variant evals will error individually)
- The `Evaluation` type change is additive (optional field)
- No new shared catalog entries needed
