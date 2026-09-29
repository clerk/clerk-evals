import { defineGraders, getFileContent } from '@/src/graders'

const file = (actual: string, filePath: string) => getFileContent(actual, filePath) ?? ''

function packageJson(actual: string): Record<string, unknown> | null {
  try {
    return JSON.parse(file(actual, 'package.json')) as Record<string, unknown>
  } catch {
    return null
  }
}

function clerkMajor(actual: string): number | null {
  const pkg = packageJson(actual)
  const dependencies = pkg?.dependencies
  if (!dependencies || typeof dependencies !== 'object') return null

  const version = (dependencies as Record<string, unknown>)['@clerk/nextjs']
  if (typeof version !== 'string') return null

  const match = version.match(/\d+/)
  return match ? Number.parseInt(match[0], 10) : null
}

function sourceFiles(actual: string): string {
  return [
    'app/layout.tsx',
    'app/sign-in/[[...sign-in]]/page.tsx',
    'app/sign-up/[[...sign-up]]/page.tsx',
    'app/billing/page.tsx',
    'components/auth-controls.tsx',
    'components/session-switcher.tsx',
    'lib/session-data.ts',
  ]
    .map((filePath) => file(actual, filePath))
    .join('\n')
}

export const graders = defineGraders({
  core_3_dependency: async (actual) => (clerkMajor(actual) ?? 0) >= 7,
  supported_node_runtime: async (actual) => {
    const pkg = packageJson(actual)
    const engines = pkg?.engines
    const node =
      engines && typeof engines === 'object' ? (engines as Record<string, unknown>).node : undefined
    return typeof node === 'string' && /20\.(?:9|[1-9]\d)|2[1-9]\./.test(node)
  },
  provider_inside_body: async (actual) => {
    const layout = file(actual, 'app/layout.tsx')
    const body = layout.indexOf('<body')
    const provider = layout.indexOf('<ClerkProvider')
    const providerEnd = layout.indexOf('</ClerkProvider>')
    const bodyEnd = layout.indexOf('</body>')
    return body >= 0 && provider > body && providerEnd > provider && bodyEnd > providerEnd
  },
  appearance_uses_options: async (actual) =>
    /appearance\s*=\s*\{\{[\s\S]*?options\s*:/.test(file(actual, 'app/layout.tsx')),
  show_auth_states: async (actual) => {
    const controls = file(actual, 'components/auth-controls.tsx')
    return (
      /<Show\s+when=["']signed-out["']/.test(controls) &&
      /<Show\s+when=["']signed-in["']/.test(controls)
    )
  },
  show_billing_permission: async (actual) =>
    /<Show\s+when=\{\{\s*permission\s*:\s*["']org:billing:manage["']/.test(
      file(actual, 'components/auth-controls.tsx'),
    ),
  fallback_redirects: async (actual) =>
    /fallbackRedirectUrl/.test(file(actual, 'app/sign-in/[[...sign-in]]/page.tsx')) &&
    /fallbackRedirectUrl/.test(file(actual, 'app/sign-up/[[...sign-up]]/page.tsx')),
  current_session_collection: async (actual) =>
    /\bclient\.sessions\b/.test(file(actual, 'lib/session-data.ts')),
  current_type_import: async (actual) =>
    /from\s+["']@clerk\/shared\/types["']/.test(file(actual, 'lib/session-data.ts')),
  navigate_callback: async (actual) => {
    const switcher = file(actual, 'components/session-switcher.tsx')
    return /\bnavigate\s*:/.test(switcher) && /decorateUrl/.test(switcher)
  },
  no_core_2_apis: async (actual) =>
    !/\b(?:SignedIn|SignedOut|Protect|beforeEmit|activeSessions|afterSignInUrl|afterSignUpUrl|redirectUrl)\b|@clerk\/types/.test(
      sourceFiles(actual),
    ),
})
