import { describe, expect, test } from 'bun:test'
import { nextjsGraders } from './shared'

const artifact = [
  '## Final response',
  'Done.',
  '## Final workspace',
  '### package.json',
  '{"dependencies":{"next":"16.0.0"}}',
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

  test('requires proxy.ts for Next 16 and middleware.ts for Next 15', async () => {
    expect(await nextjsGraders(16).correct_middleware_file(artifact)).toBe(true)
    expect(await nextjsGraders(15).correct_middleware_file(artifact)).toBe(false)
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
