import { describe, expect, test } from 'bun:test'
import { getRun, initDB, saveRun } from './db'

describe('source-version recording', () => {
  test('persists and reads the exact Skills SHA and CLI version', () => {
    initDB()
    const runId = `version-test-${crypto.randomUUID()}`
    const skillsCommit = 'a'.repeat(40)
    saveRun({
      runId,
      mode: 'agent-claude-code-skills',
      models: ['claude-code:test'],
      evalKeys: ['evals/add-auth::nextjs'],
      suiteHash: 'test',
      skillsCommit,
      cliVersion: '1.2.3',
    })
    expect(getRun(runId)).toMatchObject({ skillsCommit, cliVersion: '1.2.3' })
  })
})
