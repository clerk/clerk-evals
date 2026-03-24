/**
 * Filesystem-based graders for agent evaluations.
 *
 * Unlike text graders that check stdout, filesystem graders inspect
 * actual files created/modified by the agent in its working directory.
 *
 * Usage in graders.ts:
 *   import { fileExists, fileContains, packageHasDep } from '@/src/graders/filesystem'
 *
 *   export const graders = defineGraders({
 *     has_middleware: fileExists('middleware.ts'),
 *     uses_clerk_provider: fileContains('app/layout.tsx', '<ClerkProvider'),
 *     has_clerk_dep: packageHasDep('@clerk/nextjs'),
 *   })
 *
 * Filesystem graders conform to the same Grader signature: (input: string) => Promise<boolean>
 * The `input` parameter is ignored — the workDir is captured via closure at grading time.
 */

import { execSync } from 'node:child_process'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'

/**
 * Creates a grader that checks if a file exists in the work directory.
 * Returns a factory that takes a workDir and returns a standard Grader.
 */
export function fileExists(relPath: string) {
  return (workDir: string) =>
    async (_input: string): Promise<boolean> => {
      try {
        await stat(path.join(workDir, relPath))
        return true
      } catch {
        return false
      }
    }
}

/**
 * Creates a grader that checks if a file contains a string or matches a regex.
 */
export function fileContains(relPath: string, needle: string | RegExp) {
  return (workDir: string) =>
    async (_input: string): Promise<boolean> => {
      try {
        const content = await readFile(path.join(workDir, relPath), 'utf8')
        if (typeof needle === 'string') {
          return content.toLowerCase().includes(needle.toLowerCase())
        }
        return needle.test(content)
      } catch {
        return false
      }
    }
}

/**
 * Creates a grader that checks if package.json has a dependency.
 */
export function packageHasDep(dep: string) {
  return (workDir: string) =>
    async (_input: string): Promise<boolean> => {
      try {
        const raw = await readFile(path.join(workDir, 'package.json'), 'utf8')
        const pkg = JSON.parse(raw)
        return dep in (pkg.dependencies ?? {}) || dep in (pkg.devDependencies ?? {})
      } catch {
        return false
      }
    }
}

/**
 * Creates a grader that runs a shell command and checks it succeeds (exit code 0).
 */
export function commandSucceeds(cmd: string) {
  return (workDir: string) =>
    async (_input: string): Promise<boolean> => {
      try {
        execSync(cmd, { cwd: workDir, stdio: 'pipe', timeout: 60_000 })
        return true
      } catch {
        return false
      }
    }
}

/**
 * Type for a filesystem grader factory.
 * Call with workDir to get a standard Grader function.
 */
export type FilesystemGraderFactory = (workDir: string) => (input: string) => Promise<boolean>

/**
 * Binds filesystem grader factories to a specific work directory.
 * Returns a standard Graders record compatible with runGraders().
 */
export function bindFilesystemGraders(
  factories: Record<string, FilesystemGraderFactory>,
  workDir: string,
): Record<string, (input: string) => Promise<boolean>> {
  const bound: Record<string, (input: string) => Promise<boolean>> = {}
  for (const [name, factory] of Object.entries(factories)) {
    bound[name] = factory(workDir)
  }
  return bound
}
