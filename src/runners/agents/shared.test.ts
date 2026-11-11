import { mkdir, symlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { afterEach, describe, expect, test } from 'bun:test'
import {
  AGENT_PACKAGE_CACHE_DIR,
  buildAgentEnvironment,
  buildVerificationEnvironment,
  cleanupTempWorkDir,
  createTempHomeDir,
  createTempWorkDir,
  gradeAgentWorkspace,
  getCodexGatewayArgs,
  runHiddenVerification,
  snapshotWorkDir,
} from './shared'

const workDirs: string[] = []
const savedEnv: Record<string, string | undefined> = {}

function setEnv(name: string, value: string | undefined) {
  if (!(name in savedEnv)) savedEnv[name] = process.env[name]
  if (value === undefined) delete process.env[name]
  else process.env[name] = value
}

afterEach(async () => {
  await Promise.all(workDirs.splice(0).map(cleanupTempWorkDir))
  for (const [name, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[name]
    else process.env[name] = value
    delete savedEnv[name]
  }
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

describe('agent home isolation', () => {
  test('creates a fresh home outside the real HOME and the repository', async () => {
    const homeDir = await createTempHomeDir('isolation')
    workDirs.push(homeDir)
    expect(homeDir).not.toBe(process.env.HOME)
    expect(homeDir.startsWith(process.cwd())).toBe(false)
  })

  test.each(['claude-code', 'codex'] as const)(
    'runs %s with the temp home instead of the real HOME',
    (agentType) => {
      setEnv('HOME', '/Users/real-user')
      const env = buildAgentEnvironment(agentType, '/bin', '/tmp/agent-home', 'gateway-secret')

      expect(env.HOME).toBe('/tmp/agent-home')
      expect(env.PATH).toBe('/bin')
    },
  )

  test('shares package caches outside the temp home', () => {
    const first = buildAgentEnvironment('claude-code', '/bin', '/tmp/home-a', 'gateway-secret')
    const second = buildAgentEnvironment('codex', '/bin', '/tmp/home-b', 'gateway-secret')

    expect(first.npm_config_cache).toBe(path.join(AGENT_PACKAGE_CACHE_DIR, 'npm'))
    expect(first.BUN_INSTALL_CACHE_DIR).toBe(path.join(AGENT_PACKAGE_CACHE_DIR, 'bun'))
    expect(second.npm_config_cache).toBe(first.npm_config_cache)
    expect(second.BUN_INSTALL_CACHE_DIR).toBe(first.BUN_INSTALL_CACHE_DIR)
  })

  test('does not forward host agent config locations', () => {
    setEnv('CLAUDE_CONFIG_DIR', '/Users/real-user/.claude')
    setEnv('CODEX_HOME', '/Users/real-user/.codex')
    setEnv('XDG_CONFIG_HOME', '/Users/real-user/.config')
    const env = buildAgentEnvironment('codex', '/bin', '/tmp/agent-home', 'gateway-secret')

    expect(env.CLAUDE_CONFIG_DIR).toBeUndefined()
    expect(env.CODEX_HOME).toBeUndefined()
    expect(env.XDG_CONFIG_HOME).toBeUndefined()
  })

  test('runs hidden verification with the given home', () => {
    setEnv('HOME', '/Users/real-user')
    const env = buildVerificationEnvironment('/bin', '/tmp/workspace', '/tmp/verify-home')

    expect(env.HOME).toBe('/tmp/verify-home')
    expect(env.CLERK_EVAL_WORKSPACE).toBe('/tmp/workspace')
  })
})

describe('agent direct API keys', () => {
  function clearGatewayEnv() {
    for (const name of ['VERCEL_AI_GATEWAY_API_KEY', 'AI_GATEWAY_API_KEY', 'VERCEL_OIDC_TOKEN']) {
      setEnv(name, undefined)
    }
  }

  test('passes the Anthropic key to Claude Code', () => {
    clearGatewayEnv()
    setEnv('ANTHROPIC_API_KEY', 'anthropic-secret')
    const env = buildAgentEnvironment('claude-code', '/bin', '/tmp/agent-home')

    expect(env.ANTHROPIC_API_KEY).toBe('anthropic-secret')
    expect(env.ANTHROPIC_AUTH_TOKEN).toBeUndefined()
  })

  test('passes the OpenAI key to Codex as CODEX_API_KEY', () => {
    clearGatewayEnv()
    setEnv('CODEX_API_KEY', undefined)
    setEnv('OPENAI_API_KEY', 'openai-secret')
    const env = buildAgentEnvironment('codex', '/bin', '/tmp/agent-home')

    expect(env.CODEX_API_KEY).toBe('openai-secret')
    expect(env.OPENAI_API_KEY).toBe('openai-secret')
  })
})

describe('agent gateway configuration', () => {
  test('maps one gateway credential to Claude Code variables', () => {
    const env = buildAgentEnvironment('claude-code', '/bin', '/tmp/agent-home', 'gateway-secret')

    expect(env.ANTHROPIC_AUTH_TOKEN).toBe('gateway-secret')
    expect(env.ANTHROPIC_BASE_URL).toBe('https://ai-gateway.vercel.sh')
    expect(env.ANTHROPIC_API_KEY).toBeUndefined()
  })

  test('configures Codex to use the gateway Responses API', () => {
    const env = buildAgentEnvironment('codex', '/bin', '/tmp/agent-home', 'gateway-secret')
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
    expect(result.output).toMatch(/4 pass|Ran 4 tests/)
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

  test('fails verification when the hidden test directory is empty', async () => {
    const workDir = await createTempWorkDir('agent-grade-empty-workspace')
    const emptyTests = await createTempWorkDir('agent-grade-empty-tests')
    workDirs.push(workDir, emptyTests)

    const result = await runHiddenVerification(
      workDir,
      { testsPath: emptyTests },
      process.env.PATH ?? '',
    )

    expect(result.passed).toBe(false)
    expect(result.output).toMatch(/did not match any test files|no tests found/i)
  })
})
