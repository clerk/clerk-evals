import { describe, expect, test } from 'bun:test'
import { execFileSync } from 'node:child_process'

const status = (expected: string, current: string): string =>
  execFileSync('bash', ['src/automation/cli-release-status.sh', expected, current], {
    encoding: 'utf8',
  }).trim()

describe('CLI release status', () => {
  test('current version matches the expected release', () => {
    expect(status('1.2.3', '1.2.3')).toBe('current')
  })

  test('a newer npm latest supersedes the expected release', () => {
    expect(status('1.2.3', '1.2.4')).toBe('superseded')
  })

  test('an older npm latest has not caught up to the expected release', () => {
    expect(status('1.2.3', '1.2.2')).toBe('mismatch')
  })
})
