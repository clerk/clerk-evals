import { mkdir, symlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { afterEach, describe, expect, test } from 'bun:test'
import {
  buildAgentEnvironment,
  cleanupTempWorkDir,
  createTempWorkDir,
  gradeAgentWorkspace,
  getCodexGatewayArgs,
  runHiddenVerification,
  snapshotWorkDir,
} from './shared'

const workDirs: string[] = []

afterEach(async () => {
  await Promise.all(workDirs.splice(0).map(cleanupTempWorkDir))
})

describe('agent workspace isolation', () => {
  test('creates workspaces outside the evaluation repository', async () => {
    const workDir = await createTempWorkDir('isolation')
    workDirs.push(workDir)
    expect(workDir.startsWith(process.cwd())).toBe(false)
  })

  test('snapshots final source files without secrets or harness context', async () => {
    const workDir = await createTempWorkDir('snapshot')
    workDirs.push(workDir)
    await mkdir(path.join(workDir, 'src'))
    await writeFile(path.join(workDir, 'src', 'app.tsx'), '<Show when="signed-in" />')
    await writeFile(path.join(workDir, '.env.local'), 'CLERK_SECRET_KEY=secret')
    await symlink(path.join(workDir, '.env.local'), path.join(workDir, 'linked-secret'))
    await writeFile(path.join(workDir, 'AGENTS.md'), 'hidden harness instructions')

    const snapshot = await snapshotWorkDir(workDir)
    expect(snapshot).toContain('src/app.tsx')
    expect(snapshot).toContain('<Show when="signed-in" />')
    expect(snapshot).not.toContain('CLERK_SECRET_KEY')
    expect(snapshot).not.toContain('linked-secret')
    expect(snapshot).not.toContain('hidden harness instructions')
  })
})

describe('agent gateway configuration', () => {
  test('maps one gateway credential to Claude Code variables', () => {
    const env = buildAgentEnvironment('claude-code', '/bin', 'gateway-secret')

    expect(env.ANTHROPIC_AUTH_TOKEN).toBe('gateway-secret')
    expect(env.ANTHROPIC_BASE_URL).toBe('https://ai-gateway.vercel.sh')
    expect(env.ANTHROPIC_API_KEY).toBeUndefined()
  })

  test('configures Codex to use the gateway Responses API', () => {
    const env = buildAgentEnvironment('codex', '/bin', 'gateway-secret')
    const args = getCodexGatewayArgs('gpt-5.6-luna', true)

    expect(env.VERCEL_AI_GATEWAY_API_KEY).toBe('gateway-secret')
    expect(args).toContain('openai/gpt-5.6-luna')
    expect(args).toContain('model_provider="vercel-ai-gateway"')
    expect(args).toContain('model_providers.vercel-ai-gateway.wire_api="responses"')
  })

  test('keeps native Codex arguments when no gateway is configured', () => {
    expect(getCodexGatewayArgs('gpt-5.6-luna', false)).toEqual(['--model', 'gpt-5.6-luna'])
  })
})

describe('hidden agent verification', () => {
  test('runs the machine token tests against a reference workspace', async () => {
    const workDir = await createTempWorkDir('machine-token-reference')
    workDirs.push(workDir)
    await mkdir(path.join(workDir, 'app', 'api', 'machine-data'), { recursive: true })
    await writeFile(
      path.join(workDir, 'app', 'api', 'machine-data', 'route.ts'),
      `import { auth } from '@clerk/nextjs/server'
export async function GET() {
  const { isAuthenticated } = await auth({ acceptsToken: ['api_key', 'm2m_token'] })
  if (!isAuthenticated) return Response.json({}, { status: 401 })
  return Response.json({ authenticated: true }, { status: 200 })
}`,
    )
    await writeFile(
      path.join(workDir, 'proxy.ts'),
      `import { clerkMiddleware } from '@clerk/nextjs/server'
export default clerkMiddleware()`,
    )
    await writeFile(
      path.join(workDir, 'bunfig.toml'),
      `[test]
pathIgnorePatterns = ["**"]`,
    )

    const result = await runHiddenVerification(
      workDir,
      {
        testsPath: path.join(process.cwd(), 'src/evals/auth/machine-tokens/agent/hidden-tests'),
      },
      process.env.PATH ?? '',
    )

    expect(result.passed).toBe(true)
    expect(result.output).not.toContain(workDir)
  })

  test('hard-gates a failed hidden test without inflating a passing score', async () => {
    const evalDir = await createTempWorkDir('agent-grade')
    const workDir = await createTempWorkDir('agent-grade-workspace')
    const passingTests = await createTempWorkDir('agent-grade-pass')
    const failingTests = await createTempWorkDir('agent-grade-fail')
    workDirs.push(evalDir, workDir, passingTests, failingTests)

    const gradersPath = path.join(evalDir, 'graders.ts')
    await writeFile(
      gradersPath,
      `export const graders = {
  passes: async () => true,
  fails: async () => false,
}`,
    )
    await writeFile(
      path.join(passingTests, 'verification.test.ts'),
      `import { expect, test } from 'bun:test'
test('uses a restricted environment', () => {
  expect(process.env.OPENAI_API_KEY).toBeUndefined()
  expect(process.env.ANTHROPIC_API_KEY).toBeUndefined()
})`,
    )
    await writeFile(
      path.join(failingTests, 'verification.test.ts'),
      `import { expect, test } from 'bun:test'
test('fails', () => expect(false).toBe(true))`,
    )

    const passing = await gradeAgentWorkspace({
      workDir,
      finalResponse: 'done',
      evalPath: evalDir,
      gradersPath,
      verification: { testsPath: passingTests },
      envPath: process.env.PATH ?? '',
    })
    const failing = await gradeAgentWorkspace({
      workDir,
      finalResponse: 'done',
      evalPath: evalDir,
      gradersPath,
      verification: { testsPath: failingTests },
      envPath: process.env.PATH ?? '',
    })

    expect(passing.score).toBe(0.5)
    expect(failing.score).toBe(0)
    expect(passing.gradingArtifact).not.toContain('uses a restricted environment')
    expect(failing.graderResults).toContainEqual(['hidden_functional_tests', false])
  })

  test('treats a missing hidden test directory as an infrastructure error', async () => {
    const workDir = await createTempWorkDir('agent-grade-missing')
    workDirs.push(workDir)

    expect(
      runHiddenVerification(
        workDir,
        { testsPath: path.join(workDir, 'missing') },
        process.env.PATH ?? '',
      ),
    ).rejects.toThrow()
  })
})
