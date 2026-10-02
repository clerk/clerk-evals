import { describe, expect, test } from 'bun:test'
import { resolveSourceVersions } from './source-versions'

const sha = 'a'.repeat(40)
const otherSha = 'b'.repeat(40)

describe('run source versions', () => {
  test('records the requested skills and CLI versions for a baseline run', () => {
    expect(
      resolveSourceVersions({
        skillsEnabled: false,
        skillsPath: '',
        requestedSkillsSha: sha,
        cliVersion: '1.2.3',
      }),
    ).toEqual({
      skillsCommit: sha,
      cliVersion: '1.2.3',
    })
  })

  test('records the installed checkout only when it matches the evaluated SHA', () => {
    expect(
      resolveSourceVersions({
        skillsEnabled: true,
        skillsPath: '/skills',
        requestedSkillsSha: sha,
        cliVersion: '1.2.3',
        readCommit: () => sha,
      }),
    ).toEqual({
      skillsCommit: sha,
      cliVersion: '1.2.3',
    })
    expect(() =>
      resolveSourceVersions({
        skillsEnabled: true,
        skillsPath: '/skills',
        requestedSkillsSha: sha,
        readCommit: () => otherSha,
      }),
    ).toThrow('does not match')
  })

  test('does not silently accept a missing checkout or abbreviated SHA', () => {
    expect(() =>
      resolveSourceVersions({
        skillsEnabled: true,
        skillsPath: '/missing',
        readCommit: () => undefined,
      }),
    ).toThrow('missing')
    expect(() =>
      resolveSourceVersions({ skillsEnabled: false, skillsPath: '', requestedSkillsSha: 'abc' }),
    ).toThrow('40-character')
  })
})
