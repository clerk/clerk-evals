import { describe, expect, test } from 'bun:test'
import { nextjsGraders } from './shared'
import { getProjectFile } from '../project-root'

const artifact = [
  '## Final response',
  'Done.',
  '## Final workspace',
  '### package.json',
  '{"dependencies":{"next":"16.0.0"}}',
  '### tsconfig.json',
  '{}',
  '### proxy.ts',
  "import { clerkMiddleware } from '@clerk/nextjs/server'",
  'export default clerkMiddleware()',
  '### app/layout.tsx',
  '<html><body><ClerkProvider><SignInButton /><SignUpButton /><UserButton /></ClerkProvider></body></html>',
].join('\n\n')

describe('Next.js prompt A/B graders', () => {
  test('checks generated files and commands, not the agent prose', async () => {
    const graders = nextjsGraders(16)
    const context = { executedCommands: ['npx -y clerk@latest init'] }
    for (const grader of Object.values(graders)) {
      expect(await grader(artifact, context)).toBe(true)
    }
    expect(
      await graders.ran_clerk_init('I ran npx -y clerk@latest init', { executedCommands: [] }),
    ).toBe(false)
  })

  test('requires the version-specific TypeScript file in the active app directory', async () => {
    expect(await nextjsGraders(16).correct_middleware_file(artifact)).toBe(true)
    expect(await nextjsGraders(15).correct_middleware_file(artifact)).toBe(false)

    const next16Js = artifact.replace('### proxy.ts', '### proxy.js')
    expect(await nextjsGraders(16).correct_middleware_file(next16Js)).toBe(false)
    expect(await nextjsGraders(15).correct_middleware_file(next16Js)).toBe(false)

    const next15Ts = artifact.replace('### proxy.ts', '### middleware.ts')
    expect(await nextjsGraders(15).correct_middleware_file(next15Ts)).toBe(true)

    const misplaced = artifact.replace('### proxy.ts', '### src/proxy.ts')
    expect(await nextjsGraders(16).correct_middleware_file(misplaced)).toBe(false)

    const srcApp = artifact
      .replace('### app/layout.tsx', '### src/app/layout.tsx')
      .replace('### proxy.ts', '### src/proxy.ts')
    expect(await nextjsGraders(16).correct_middleware_file(srcApp)).toBe(true)
    expect(
      await nextjsGraders(16).correct_middleware_file(
        srcApp.replace('### src/proxy.ts', '### proxy.ts'),
      ),
    ).toBe(false)
  })

  test('accepts JavaScript only for a JavaScript project', async () => {
    const javascript = artifact
      .replace('### tsconfig.json\n\n{}\n\n', '')
      .replace('### app/layout.tsx', '### app/layout.jsx')
      .replace('### proxy.ts', '### proxy.js')
    expect(await nextjsGraders('empty').correct_middleware_file(javascript)).toBe(true)
    expect(await nextjsGraders(16).correct_middleware_file(javascript)).toBe(false)
    expect(
      await nextjsGraders('empty').correct_middleware_file(
        javascript.replace('### proxy.js', '### proxy.ts'),
      ),
    ).toBe(false)
  })

  test('scores files in the single scaffolded subdirectory', async () => {
    const nested = artifact.replaceAll('### ', '### my-clerk-next-app/')
    expect(getProjectFile(nested, 'package.json')).toContain('next')
    const graders = nextjsGraders('empty')
    const context = { executedCommands: ['npx -y clerk@latest init --framework next'] }
    for (const grader of Object.values(graders)) {
      expect(await grader(nested, context)).toBe(true)
    }
  })

  test('requires framework next for an empty directory and rejects unrequested flags in existing apps', async () => {
    const empty = nextjsGraders('empty')
    expect(
      await empty.appropriate_init_flags('', {
        executedCommands: ['npx -y clerk@latest init --framework next --pm npm'],
      }),
    ).toBe(true)
    expect(
      await empty.appropriate_init_flags('', { executedCommands: ['npx -y clerk@latest init'] }),
    ).toBe(false)
    const existing = nextjsGraders(16)
    expect(
      await existing.appropriate_init_flags('', {
        executedCommands: ['npx -y clerk@latest init --framework next'],
      }),
    ).toBe(false)
  })

  test('detects login before init and global Clerk CLI installation', async () => {
    const graders = nextjsGraders(16)
    const context = {
      executedCommands: [
        'npx -y clerk@latest auth login',
        'npm install -g clerk',
        'npx -y clerk@latest init',
      ],
    }
    expect(await graders.no_login_before_init('', context)).toBe(false)
    expect(await graders.no_global_clerk_cli_install('', context)).toBe(false)
    expect(await graders.no_unrequested_account_commands('', context)).toBe(false)
    expect(
      await graders.no_unrequested_account_commands('', {
        executedCommands: ['npx -y clerk@latest init', 'npx -y clerk@latest deploy'],
      }),
    ).toBe(false)
  })

  test('accepts the package runners listed by the dedicated prompt', async () => {
    const graders = nextjsGraders(16)
    expect(
      await graders.ran_clerk_init('', { executedCommands: ['pnpm dlx clerk@latest init'] }),
    ).toBe(true)
    expect(await graders.ran_clerk_init('', { executedCommands: ['bunx clerk@latest init'] })).toBe(
      true,
    )
  })
})
