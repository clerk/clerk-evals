import { cp, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { afterEach, describe, expect, test } from 'bun:test'
import { runGraders } from '@/src/runners/shared'
import {
  buildAgentGradingArtifact,
  cleanupTempWorkDir,
  createTempWorkDir,
  runHiddenVerification,
} from '@/src/runners/agents/shared'
import { graders } from './graders/nextjs'

const fixturePath = path.join(import.meta.dir, 'fixtures', 'nextjs')
const hiddenTestsPath = path.join(import.meta.dir, 'agent', 'hidden-tests')
const workDirs: string[] = []

afterEach(async () => {
  await Promise.all(workDirs.splice(0).map(cleanupTempWorkDir))
})

async function createWorkspace(): Promise<string> {
  const workDir = await createTempWorkDir('core-3-contract')
  workDirs.push(workDir)
  await cp(fixturePath, workDir, { recursive: true })
  return workDir
}

async function writeReferenceUpgrade(workDir: string): Promise<void> {
  const packagePath = path.join(workDir, 'package.json')
  const packageJson = JSON.parse(await readFile(packagePath, 'utf8')) as {
    dependencies: Record<string, string>
    engines: Record<string, string>
  }
  packageJson.dependencies['@clerk/nextjs'] = '^7.0.0'
  packageJson.engines.node = '>=20.9.0'
  await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`)

  await writeFile(
    path.join(workDir, 'app', 'layout.tsx'),
    `import { ClerkProvider } from '@clerk/nextjs'
import type { ReactNode } from 'react'
import { AuthControls } from '@/components/auth-controls'

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ClerkProvider appearance={{ options: { socialButtonsPlacement: 'bottom' } }}>
          <AuthControls />
          {children}
        </ClerkProvider>
      </body>
    </html>
  )
}
`,
  )
  await writeFile(
    path.join(workDir, 'components', 'auth-controls.tsx'),
    `'use client'

import { Show, SignInButton, SignUpButton, UserButton } from '@clerk/nextjs'

export function AuthControls() {
  return (
    <nav aria-label="Account controls">
      <Show when="signed-out">
        <SignInButton />
        <SignUpButton />
      </Show>
      <Show when="signed-in">
        <UserButton />
      </Show>
      <Show when={{ permission: 'org:billing:manage' }} fallback={<span>Billing access required</span>}>
        <a href="/billing">Manage billing</a>
      </Show>
    </nav>
  )
}
`,
  )
  await writeFile(
    path.join(workDir, 'app', 'sign-in', '[[...sign-in]]', 'page.tsx'),
    `import { SignIn } from '@clerk/nextjs'

export default function SignInPage() {
  return <SignIn fallbackRedirectUrl="/dashboard" />
}
`,
  )
  await writeFile(
    path.join(workDir, 'app', 'sign-up', '[[...sign-up]]', 'page.tsx'),
    `import { SignUp } from '@clerk/nextjs'

export default function SignUpPage() {
  return <SignUp fallbackRedirectUrl="/welcome" />
}
`,
  )
  await writeFile(
    path.join(workDir, 'lib', 'session-data.ts'),
    `import type { ClientResource } from '@clerk/shared/types'

export function getOtherSessionIds(client: ClientResource, currentSessionId: string): string[] {
  return client.sessions
    .filter((session) => session.id !== currentSessionId)
    .map((session) => session.id)
}
`,
  )
  await writeFile(
    path.join(workDir, 'components', 'session-switcher.tsx'),
    `'use client'

import { useClerk } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'

export function SessionSwitcher({ sessionId }: { sessionId: string }) {
  const { setActive } = useClerk()
  const router = useRouter()

  const switchSession = async () => {
    await setActive({
      session: sessionId,
      navigate: ({ decorateUrl }) => router.push(decorateUrl('/dashboard')),
    })
  }

  return <button onClick={switchSession}>Switch session</button>
}
`,
  )
}

describe('Core 3 upgrade contract', () => {
  test('rejects the Core 2 fixture', async () => {
    const workDir = await createWorkspace()
    const artifact = await buildAgentGradingArtifact(workDir, 'Upgrade complete.')
    const results = await runGraders(graders, artifact)
    const verification = await runHiddenVerification(
      workDir,
      { testsPath: hiddenTestsPath },
      process.env.PATH ?? '',
    )

    expect(results.every(([, passed]) => !passed)).toBe(true)
    expect(verification.passed).toBe(false)
  })

  test('accepts a complete Core 3 upgrade', async () => {
    const workDir = await createWorkspace()
    await writeReferenceUpgrade(workDir)
    const artifact = await buildAgentGradingArtifact(workDir, 'Upgrade complete.')
    const results = await runGraders(graders, artifact)
    const verification = await runHiddenVerification(
      workDir,
      { testsPath: hiddenTestsPath },
      process.env.PATH ?? '',
    )

    expect(results.filter(([, passed]) => !passed)).toEqual([])
    expect(verification.passed).toBe(true)
    expect(verification.output).toMatch(/7 pass|Ran 7 tests/)
  })
})
