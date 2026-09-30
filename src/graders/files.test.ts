import { describe, expect, test } from 'bun:test'
import { getFileContent } from './files'

describe('file-scoped grading', () => {
  test('extracts an exact fenced file and ignores prose', () => {
    const actual = `The answer uses app/route.ts with auth().

\`\`\`ts file="app/route.ts"
export const value = 'from file'
\`\`\``

    expect(getFileContent(actual, 'app/route.ts')).toBe("export const value = 'from file'")
    expect(getFileContent(actual, 'app/missing.ts')).toBeNull()
  })

  test('uses the final workspace instead of a claimed response file', () => {
    const actual = `## Final response

## Final workspace

### app/route.ts

export const value = 'claimed'

## Final workspace

### app/route.ts

export const value = 'actual'

### app/page.tsx

export default function Page() { return null }`

    expect(getFileContent(actual, 'app/route.ts')).toBe("export const value = 'actual'")
    expect(getFileContent(actual, 'app/missing.ts')).toBeNull()
  })
})
