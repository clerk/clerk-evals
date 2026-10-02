import { defineGraders, getFileContent } from '@/src/graders'

const machineRoute = (actual: string) => getFileContent(actual, 'app/api/machine-data/route.ts')
const proxy = (actual: string) => getFileContent(actual, 'proxy.ts')

function acceptedTokenTypes(actual: string): string[] | null {
  const match = /acceptsToken\s*:\s*\[([^\]]+)\]/.exec(actual)
  if (!match?.[1]) return null
  return [...match[1].matchAll(/['"]([^'"]+)['"]/g)].map((token) => token[1] as string)
}

function acceptsOnlyRequiredMachineTokens(actual: string): boolean {
  const tokenTypes = acceptedTokenTypes(actual)
  if (!tokenTypes) return false
  return (
    tokenTypes.length === 2 && tokenTypes.includes('api_key') && tokenTypes.includes('m2m_token')
  )
}

function unauthenticatedBranch(actual: string): string | null {
  const match = /if\s*\(\s*!\s*(?:\w+\.)?isAuthenticated\s*\)\s*\{/.exec(actual)
  if (!match) return null

  const openingBrace = actual.indexOf('{', match.index)
  let depth = 0
  for (let index = openingBrace; index < actual.length; index += 1) {
    if (actual[index] === '{') depth += 1
    if (actual[index] === '}') depth -= 1
    if (depth === 0) return actual.slice(openingBrace + 1, index)
  }
  return null
}

export const graders = defineGraders({
  machine_route_file: async (actual) => machineRoute(actual) !== null,
  proxy_file: async (actual) => proxy(actual) !== null,
  imports_auth_from_server: async (actual) =>
    /import\s*\{[^}]*\bauth\b[^}]*\}\s*from\s*['"]@clerk\/nextjs\/server['"]/.test(
      machineRoute(actual) ?? '',
    ),
  accepts_api_key_and_m2m_only: async (actual) =>
    acceptsOnlyRequiredMachineTokens(machineRoute(actual) ?? ''),
  checks_is_authenticated: async (actual) =>
    unauthenticatedBranch(machineRoute(actual) ?? '') !== null,
  unauthenticated_returns_401: async (actual) => {
    const branch = unauthenticatedBranch(machineRoute(actual) ?? '')
    return branch !== null && /status\s*:\s*401/.test(branch)
  },
  success_returns_200: async (actual) => /status\s*:\s*200/.test(machineRoute(actual) ?? ''),
  imports_clerk_middleware: async (actual) =>
    /import\s*\{[^}]*\bclerkMiddleware\b[^}]*\}\s*from\s*['"]@clerk\/nextjs\/server['"]/.test(
      proxy(actual) ?? '',
    ),
  calls_clerk_middleware: async (actual) => /\bclerkMiddleware\s*\(\s*\)/.test(proxy(actual) ?? ''),
  no_manual_authorization_header: async (actual) =>
    machineRoute(actual) !== null &&
    !/headers\.get\s*\(\s*['"]authorization['"]\s*\)/i.test(machineRoute(actual) ?? ''),
})
