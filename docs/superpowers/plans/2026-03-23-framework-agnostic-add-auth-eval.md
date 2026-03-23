# Framework-Agnostic "Add Auth" Agent Eval — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a framework-agnostic "Add Auth" evaluation that tests how well agents add Clerk authentication across different project environments (Next.js, React, Android, iOS) using a single shared prompt and per-variant fixtures/graders.

**Architecture:** A single eval at `src/evals/add-auth/` with a shared `PROMPT.md`, per-variant fixture directories copied into the agent's temp work dir before execution, and per-variant grader files. The `Evaluation` type gains an optional `variant` field; the agent runner gains `fixturesPath`/`gradersPath` support.

**Tech Stack:** TypeScript, Bun, existing grader primitives (`contains`, `containsAny`, `not`, `judge`, `defineGraders`)

**Spec:** `docs/superpowers/specs/2026-03-23-framework-agnostic-add-auth-eval-design.md`

---

### Task 1: Add `variant` to types and `'Add Auth'` to Category

**Files:**
- Modify: `src/interfaces/index.ts:107-121`
- Modify: `src/interfaces/agent.ts:38-55`

- [ ] **Step 1: Add `'Add Auth'` to `Category` union and `variant` to `Evaluation`**

In `src/interfaces/index.ts`, add `'Add Auth'` to the `Category` type and `variant?: string` to `Evaluation`:

```ts
// At line 115, before the closing of Category:
  | 'Upgrades'
  | 'Add Auth'

// At line 121, add variant to Evaluation:
export type Evaluation = {
  framework: Framework
  category: Category
  /** e.g. "evals/basic-nextjs" */
  path: string
  /** Variant subdirectory for fixture-based evals (e.g., 'nextjs', 'android') */
  variant?: string
}
```

- [ ] **Step 2: Add `fixturesPath` and `gradersPath` to `AgentRunnerArgs`**

In `src/interfaces/agent.ts`, add two optional fields at the end of `AgentRunnerArgs` (after `envPath`):

```ts
  /** Path to fixtures directory to copy into work dir before execution */
  fixturesPath?: string
  /** Full path to the variant grader file (e.g., .../graders/nextjs.ts) */
  gradersPath?: string
```

- [ ] **Step 3: Lint**

Run: `bunx biome check src/interfaces/index.ts src/interfaces/agent.ts`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/interfaces/index.ts src/interfaces/agent.ts
git commit -m "feat: add variant support to Evaluation type and AgentRunnerArgs"
```

---

### Task 2: Add `copyFixtures` to agent runner shared utils

**Files:**
- Modify: `src/runners/agents/shared.ts:1-5` (add export)

- [ ] **Step 1: Add `copyFixtures` function**

In `src/runners/agents/shared.ts`, add this function after the existing `cleanupTempWorkDir`:

```ts
/**
 * Copies fixture files into the agent's working directory.
 * Must be called before createTempMCPConfig/setupSkills so overlays work correctly.
 */
export async function copyFixtures(workDir: string, fixturesPath: string): Promise<void> {
  await fs.cp(fixturesPath, workDir, { recursive: true, force: true })
}
```

- [ ] **Step 2: Lint**

Run: `bunx biome check src/runners/agents/shared.ts`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/runners/agents/shared.ts
git commit -m "feat: add copyFixtures utility for agent runners"
```

---

### Task 3: Wire fixtures and variant graders into claude-code runner

**Files:**
- Modify: `src/runners/agents/claude-code.ts:111-181`

- [ ] **Step 1: Add `fixturesPath` and `gradersPath` to exec destructuring**

At `src/runners/agents/claude-code.ts:111-118`, add the new fields to the destructured args:

```ts
export default async function exec({
  evalPath,
  debug = false,
  mcpConfig,
  skillsConfig,
  timeout = DEFAULT_AGENT_TIMEOUT,
  executablePath,
  envPath,
  fixturesPath,
  gradersPath,
}: AgentRunnerArgs): Promise<RunnerResult> {
```

- [ ] **Step 2: Add `copyFixtures` import**

Add `copyFixtures` to the import from `'./shared'`:

```ts
import {
  buildAgentPrompt,
  cleanupTempMCPConfig,
  cleanupTempWorkDir,
  copyFixtures,
  createTempMCPConfig,
  createTempWorkDir,
  DEFAULT_AGENT_TIMEOUT,
  setupSkills,
} from './shared'
```

- [ ] **Step 3: Copy fixtures before MCP/skills setup**

After `workDir = await createTempWorkDir()` (line 135) and **before** the MCP config block (line 138), insert:

```ts
    // 2b. Copy fixtures into work dir (before MCP/skills setup)
    if (fixturesPath) {
      await copyFixtures(workDir, fixturesPath)
    }
```

- [ ] **Step 4: Use variant-aware grader loading**

Replace the grader loading at line 179:

```ts
    // 5. Run graders against output
    const graders = await loadGraders(evalPath)
```

With:

```ts
    // 5. Run graders against output (variant-aware)
    const graderModule = gradersPath
      ? ((await import(gradersPath)) as { graders: Graders })
      : ((await import(path.join(evalPath, 'graders.ts'))) as { graders: Graders })
    const graders = graderModule.graders
```

And add the needed imports at the top of the file (after `import { spawn } from 'node:child_process'`):

```ts
import path from 'node:path'
import type { Graders } from '@/src/graders'
```

Update the `'@/src/runners/shared'` import to remove `loadGraders` (no longer used):

```ts
import { computeScore, runGraders } from '@/src/runners/shared'
```

- [ ] **Step 5: Lint**

Run: `bunx biome check src/runners/agents/claude-code.ts`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add src/runners/agents/claude-code.ts
git commit -m "feat: support fixtures and variant graders in claude-code runner"
```

---

### Task 4: Wire variant fields through agent-index.ts

**Files:**
- Modify: `src/agent-index.ts:170-220`

- [ ] **Step 1: Add variant fields to task building**

At `src/agent-index.ts:170-177`, update the tasks map to include fixture and grader paths:

```ts
// Build tasks
const tasks = filteredEvaluations.map((evaluation) => ({
  agent: agentType,
  category: evaluation.category,
  framework: evaluation.framework,
  evalPath: path.join(process.cwd(), 'src', evaluation.path),
  evaluationPath: evaluation.path,
  fixturesPath: evaluation.variant
    ? path.join(process.cwd(), 'src', evaluation.path, 'fixtures', evaluation.variant)
    : undefined,
  gradersPath: evaluation.variant
    ? path.join(process.cwd(), 'src', evaluation.path, 'graders', `${evaluation.variant}.ts`)
    : undefined,
}))
```

- [ ] **Step 2: Pass new fields into AgentRunnerArgs**

At `src/agent-index.ts:200-220`, add the new fields to the `runnerArgs` object. Add these two lines after the `envPath` line (line 219):

```ts
      fixturesPath: task.fixturesPath,
      gradersPath: task.gradersPath,
```

- [ ] **Step 3: Lint**

Run: `bunx biome check src/agent-index.ts`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/agent-index.ts
git commit -m "feat: thread variant fixture/grader paths through agent pipeline"
```

---

### Task 5: Create PROMPT.md

**Files:**
- Create: `src/evals/add-auth/PROMPT.md`

- [ ] **Step 1: Create the eval directory and prompt**

Create `src/evals/add-auth/PROMPT.md` with the user's universal prompt:

```md
# Add Clerk Authentication

Set up Clerk authentication by following the official quickstart for this project's framework.

## Step 1: Detect the framework

Read `package.json` (if it exists) and match against this table. If there is no `package.json`, check for `build.gradle.kts` (Android) or `Package.swift` (iOS).

| Dependency | Quickstart |
|------------|-----------|
| `next` | https://clerk.com/docs/nextjs/getting-started/quickstart.md |
| `@remix-run/react` | https://clerk.com/docs/remix/getting-started/quickstart.md |
| `astro` | https://clerk.com/docs/astro/getting-started/quickstart.md |
| `nuxt` | https://clerk.com/docs/nuxt/getting-started/quickstart.md |
| `react-router` | https://clerk.com/docs/react-router/getting-started/quickstart.md |
| `@tanstack/react-start` | https://clerk.com/docs/tanstack-react-start/getting-started/quickstart.md |
| `react` (no framework) | https://clerk.com/docs/react/getting-started/quickstart.md |
| `vue` | https://clerk.com/docs/vue/getting-started/quickstart.md |
| `express` | https://clerk.com/docs/expressjs/getting-started/quickstart.md |
| `fastify` | https://clerk.com/docs/fastify/getting-started/quickstart.md |
| `expo` | https://clerk.com/docs/expo/getting-started/quickstart.md |

Other: Chrome Extension, Android, iOS, Vanilla JS at https://clerk.com/docs/llms.txt

## Step 2: Fetch and follow the quickstart

Read the quickstart URL from the table above and follow every step:
1. Install the SDK package
2. Add the provider/middleware
3. Create sign-in/sign-up routes if needed
4. Test the integration

## Step 3: API Keys

Use Keyless mode (default). No manual key setup needed. Clerk auto-generates development keys on first run and shows a "Claim your application" banner.

To use your own keys, get them from https://dashboard.clerk.com and set them as environment variables.

## Step 4: If using shadcn/ui

If `components.json` exists in the project root:

\`\`\`bash
npm install @clerk/ui
\`\`\`

Apply the theme in your provider:
\`\`\`tsx
import { shadcn } from '@clerk/ui/themes'
<ClerkProvider appearance={{ theme: shadcn }}>{children}</ClerkProvider>
\`\`\`

Add to global CSS:
\`\`\`css
@import '@clerk/ui/themes/shadcn.css';
\`\`\`

## Critical rules

- Next.js 15+: `auth()` is async. Always `await auth()`
- `ClerkProvider` goes inside `<body>`, not wrapping `<html>`
- Never expose `CLERK_SECRET_KEY` in client code
- Use `@clerk/nextjs`, not `@clerk/clerk-react`

Full documentation: https://clerk.com/docs/llms.txt
```

- [ ] **Step 2: Commit**

```bash
git add src/evals/add-auth/PROMPT.md
git commit -m "feat: add shared PROMPT.md for add-auth eval"
```

---

### Task 6: Create fixtures

**Files:**
- Create: `src/evals/add-auth/fixtures/nextjs/package.json`
- Create: `src/evals/add-auth/fixtures/nextjs/app/layout.tsx`
- Create: `src/evals/add-auth/fixtures/react/package.json`
- Create: `src/evals/add-auth/fixtures/react/index.html`
- Create: `src/evals/add-auth/fixtures/react/src/main.tsx`
- Create: `src/evals/add-auth/fixtures/android/build.gradle.kts`
- Create: `src/evals/add-auth/fixtures/android/app/src/main/AndroidManifest.xml`
- Create: `src/evals/add-auth/fixtures/android/app/src/main/java/com/example/myapp/MainActivity.kt`
- Create: `src/evals/add-auth/fixtures/ios/Package.swift`
- Create: `src/evals/add-auth/fixtures/ios/Sources/MyApp/MyApp.swift`

- [ ] **Step 1: Create Next.js fixture**

`src/evals/add-auth/fixtures/nextjs/package.json`:
```json
{
  "name": "my-nextjs-app",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  },
  "dependencies": {
    "next": "15.2.0",
    "react": "19.0.0",
    "react-dom": "19.0.0"
  },
  "devDependencies": {
    "@types/react": "19.0.0",
    "typescript": "5.7.0"
  }
}
```

`src/evals/add-auth/fixtures/nextjs/app/layout.tsx`:
```tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
```

- [ ] **Step 2: Create React fixture**

`src/evals/add-auth/fixtures/react/package.json`:
```json
{
  "name": "my-react-app",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "vite build"
  },
  "dependencies": {
    "react": "19.0.0",
    "react-dom": "19.0.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "4.3.0",
    "vite": "6.0.0",
    "typescript": "5.7.0"
  }
}
```

`src/evals/add-auth/fixtures/react/index.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>My React App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`src/evals/add-auth/fixtures/react/src/main.tsx`:
```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'

function App() {
  return <h1>My React App</h1>
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

- [ ] **Step 3: Create Android fixture**

`src/evals/add-auth/fixtures/android/build.gradle.kts`:
```kotlin
plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.example.myapp"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.example.myapp"
        minSdk = 24
        targetSdk = 35
    }

    buildFeatures {
        compose = true
    }
}

dependencies {
    implementation("androidx.activity:activity-compose:1.9.0")
    implementation("androidx.compose.material3:material3:1.3.0")
}
```

`src/evals/add-auth/fixtures/android/app/src/main/AndroidManifest.xml`:
```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <application
        android:label="My App"
        android:theme="@style/Theme.Material3.DayNight">
        <activity
            android:name=".MainActivity"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>
```

`src/evals/add-auth/fixtures/android/app/src/main/java/com/example/myapp/MainActivity.kt`:
```kotlin
package com.example.myapp

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.material3.Text

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            Text("Hello, World!")
        }
    }
}
```

- [ ] **Step 4: Create iOS fixture**

`src/evals/add-auth/fixtures/ios/Package.swift`:
```swift
// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "MyApp",
    platforms: [.iOS(.v17)],
    dependencies: [],
    targets: [
        .executableTarget(name: "MyApp", path: "Sources/MyApp"),
    ]
)
```

`src/evals/add-auth/fixtures/ios/Sources/MyApp/MyApp.swift`:
```swift
import SwiftUI

@main
struct MyApp: App {
    var body: some Scene {
        WindowGroup {
            Text("Hello, World!")
        }
    }
}
```

- [ ] **Step 5: Commit**

```bash
git add src/evals/add-auth/fixtures/
git commit -m "feat: add minimal fixtures for add-auth eval variants"
```

---

### Task 7: Create variant graders

**Files:**
- Create: `src/evals/add-auth/graders/nextjs.ts`
- Create: `src/evals/add-auth/graders/react.ts`
- Create: `src/evals/add-auth/graders/android.ts`
- Create: `src/evals/add-auth/graders/ios.ts`

- [ ] **Step 1: Create Next.js grader**

`src/evals/add-auth/graders/nextjs.ts`:
```ts
import { contains, defineGraders, not } from '@/src/graders'
import { authUIChecks, llmChecks } from '@/src/graders/catalog'

export const graders = defineGraders({
  middleware_file: contains('middleware.ts'),
  clerk_middleware_import: contains("from '@clerk/nextjs/server'"),
  clerk_middleware_usage: contains('clerkMiddleware'),
  clerk_provider_usage: contains('<ClerkProvider'),
  layout_file: contains('app/layout.tsx'),
  clerk_nextjs_package: contains('@clerk/nextjs'),
  package_json_clerk_version: llmChecks.packageJsonClerkVersion,
  environment_variables: llmChecks.environmentVariables,
  uses_signed_in: authUIChecks.usesSignedIn,
  uses_signed_out: authUIChecks.usesSignedOut,
  uses_user_button: authUIChecks.usesUserButton,
  no_auth_middleware: not(contains('authMiddleware')),
  no_pages_router: not(contains('_app.tsx')),
})
```

- [ ] **Step 2: Create React grader**

`src/evals/add-auth/graders/react.ts`:
```ts
import { contains, containsAny, defineGraders, not } from '@/src/graders'

export const graders = defineGraders({
  clerk_react_package: contains('@clerk/clerk-react'),
  clerk_provider_usage: contains('<ClerkProvider'),
  main_file: containsAny(['main.tsx', 'main.jsx']),
  publishable_key_prop: contains('publishableKey'),
  vite_env_var: contains('VITE_CLERK_PUBLISHABLE_KEY'),
  import_meta_env: contains('import.meta.env'),
  uses_signed_in: contains('<SignedIn'),
  uses_signed_out: contains('<SignedOut'),
  uses_sign_in_button: contains('<SignInButton'),
  uses_user_button: contains('<UserButton'),
  no_frontend_api: not(contains('frontendApi')),
  no_react_app_env: not(contains('REACT_APP_')),
})
```

- [ ] **Step 3: Create Android grader**

`src/evals/add-auth/graders/android.ts`:
```ts
import { contains, containsAny, defineGraders, judge, not } from '@/src/graders'

export const graders = defineGraders({
  references_clerk_android_ui: contains('clerk-android-ui'),
  initializes_in_application_class: judge({
    criteria:
      'Does the code call Clerk.initialize() inside an Application subclass (onCreate), NOT inside a Composable function or Activity?',
    examples:
      'PASS: A class extending Application overrides onCreate() and calls Clerk.initialize(this) before super or setContent.\nPASS: ClerkAndroidApplication is referenced as the application class in AndroidManifest.xml.\nFAIL: Clerk.initialize() is called inside MainActivity.onCreate() or inside a @Composable function.\nFAIL: Clerk.initialize() is called in a LaunchedEffect or remember block.',
  }),
  gates_on_initialization: containsAny(['isInitialized', 'isLoaded', 'isClerkLoaded']),
  uses_reactive_user_state: containsAny(['userFlow', 'collectAsState', 'sessionFlow']),
  uses_authview: contains('AuthView'),
  uses_user_button: contains('UserButton'),
  uses_internet_permission: contains('android.permission.INTERNET'),
  no_custom_form_leak: not(containsAny(['signIn.create', 'attemptFirstFactor', 'signUp.create'])),
  wires_publishable_key: containsAny(['publishableKey', 'pk_test_']),
})
```

- [ ] **Step 4: Create iOS grader**

`src/evals/add-auth/graders/ios.ts`:
```ts
import { contains, containsAny, defineGraders, judge } from '@/src/graders'

export const graders = defineGraders({
  references_clerk_ios_package: contains('clerk-ios'),
  imports_clerkkit: contains('ClerkKit'),
  imports_clerkkitui: contains('ClerkKitUI'),
  uses_authview: contains('AuthView'),
  wires_publishable_key: containsAny(['configure', 'publishableKey']),
  uses_prebuilt_components: judge(
    'Does the output set up a working prebuilt Clerk authentication flow using ClerkKitUI components like AuthView, with proper app configuration and key wiring?',
  ),
})
```

- [ ] **Step 5: Lint all graders**

Run: `bunx biome check src/evals/add-auth/graders/`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add src/evals/add-auth/graders/
git commit -m "feat: add per-variant graders for add-auth eval"
```

---

### Task 8: Register evaluations

**Files:**
- Modify: `src/config/evaluations.ts:74`

- [ ] **Step 1: Add registry entries**

At the end of the `EVALUATIONS` array in `src/config/evaluations.ts`, before the closing `]`, add:

```ts
  // Add Auth — framework-agnostic agent eval (4 variants, shared prompt)
  { framework: 'Next.js', category: 'Add Auth', path: 'evals/add-auth', variant: 'nextjs' },
  { framework: 'React', category: 'Add Auth', path: 'evals/add-auth', variant: 'react' },
  { framework: 'Android', category: 'Add Auth', path: 'evals/add-auth', variant: 'android' },
  { framework: 'iOS', category: 'Add Auth', path: 'evals/add-auth', variant: 'ios' },
```

- [ ] **Step 2: Lint**

Run: `bunx biome check src/config/evaluations.ts`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/config/evaluations.ts
git commit -m "feat: register add-auth eval variants in evaluation registry"
```

---

### Task 9: Smoke test

- [ ] **Step 1: Dry run to verify task matrix**

Run: `bun start:agent --agent claude-code --eval add-auth --dry`

This won't exist as a flag on agent-index, so instead verify the filter works:

Run: `bun start --eval add-auth --dry`
Expected: Shows 4 eval variants (Next.js, React, Android, iOS) in the task matrix. The dry run will fail since baseline mode can't load variant graders — that's expected. The point is to verify the filter matches all 4 variants.

- [ ] **Step 2: Run one variant with debug**

Run: `bun start:agent --agent claude-code --eval add-auth --debug`
Expected: All 4 variants execute. Check `debug-runs/` for output files. Verify that grader results appear in the debug output — this confirms fixtures were copied and graders loaded correctly.

- [ ] **Step 3: Verify a single variant score is reasonable**

Check the debug output for the Next.js variant. The graders should find patterns like `clerkMiddleware`, `<ClerkProvider`, `@clerk/nextjs` in the agent's full conversation output. If most graders pass, the pipeline is working end to end.
