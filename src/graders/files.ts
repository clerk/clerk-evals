function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function getSnapshotFile(actual: string, filePath: string): string | null {
  const workspaceMarker = '## Final workspace'
  const markerIndex = actual.lastIndexOf(workspaceMarker)
  if (markerIndex === -1) return null

  const workspace = actual.slice(markerIndex + workspaceMarker.length)
  const header = new RegExp(`^### ${escapeRegExp(filePath)}\\r?$`, 'm')
  const match = header.exec(workspace)
  if (!match) return null

  const contentStart = match.index + match[0].length
  const remaining = workspace.slice(contentStart).replace(/^\r?\n\r?\n/, '')
  const nextHeader = /^### .+\r?$/m.exec(remaining)
  return (nextHeader ? remaining.slice(0, nextHeader.index) : remaining).trim()
}

function getFencedFile(actual: string, filePath: string): string | null {
  const escapedPath = escapeRegExp(filePath)
  const fence = new RegExp(
    `^\`\`\`[^\\n]*\\bfile=(?:"${escapedPath}"|'${escapedPath}')[^\\n]*\\r?\\n([\\s\\S]*?)^\`\`\`\\s*$`,
    'gm',
  )
  const matches = [...actual.matchAll(fence)]
  return matches.at(-1)?.[1]?.trim() ?? null
}

export function getFileContent(actual: string, filePath: string): string | null {
  if (actual.includes('## Final workspace')) return getSnapshotFile(actual, filePath)
  return getFencedFile(actual, filePath)
}
