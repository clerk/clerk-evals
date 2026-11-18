import { chmod, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { afterEach, describe, expect, test } from 'bun:test'
import type { AgentExecResult } from '@/src/interfaces/agent'
import claudeRunner from './claude-code'
import codexRunner from './codex'
import { cleanupTempWorkDir, createTempWorkDir } from './shared'

const tempDirs: string[] = []

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(cleanupTempWorkDir))
})

describe('failed agent evidence', () => {
  test.each([
    ['claude-code', claudeRunner],
    ['codex', codexRunner],
  ] as const)(
    '%s reports a timed-out execution before workspace cleanup',
    async (agent, runner) => {
      const fixture = await createTempWorkDir('timed-out-agent')
      tempDirs.push(fixture)
      const executablePath = path.join(fixture, 'agent')
      await writeFile(executablePath, '#!/usr/bin/env node\nsetInterval(() => {}, 1000)\n')
      await chmod(executablePath, 0o755)

      let observed: AgentExecResult | undefined
      const result = await runner({
        agent,
        evalPath: fixture,
        promptOverride: 'Set up Clerk',
        executablePath,
        envPath: process.env.PATH ?? '/usr/bin:/bin',
        model: 'fake-model',
        timeout: 200,
        onWorkspaceReady: async (_workDir, execution) => {
          observed = execution
        },
      })

      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.error).toMatch(/Timeout after 200ms/)
      expect(observed?.timedOut).toBe(true)
    },
  )
})
