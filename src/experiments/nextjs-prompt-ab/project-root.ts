import { existsSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { getFileContent } from '@/src/graders'

export function resolveProjectRoot(workspace: string): string {
  if (existsSync(path.join(workspace, 'package.json'))) return workspace
  const projects = readdirSync(workspace, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() && existsSync(path.join(workspace, entry.name, 'package.json')),
    )
    .map((entry) => path.join(workspace, entry.name))
  if (projects.length !== 1)
    throw new Error(`Expected one Next.js project in ${workspace}, found ${projects.length}`)
  return projects[0]!
}

export function getProjectFile(artifact: string, filePath: string): string | null {
  if (getFileContent(artifact, 'package.json')) return getFileContent(artifact, filePath)
  const workspace = artifact.split('## Final workspace').at(-1) ?? ''
  const projects = [...workspace.matchAll(/^### ([^/\r\n]+)\/package\.json\r?$/gm)].map(
    (match) => match[1],
  )
  if (projects.length !== 1) return null
  return getFileContent(artifact, `${projects[0]}/${filePath}`)
}
