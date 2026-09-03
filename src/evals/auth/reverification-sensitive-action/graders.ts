import { defineGraders, getFileContent } from '@/src/graders'

const exportRoute = (actual: string) => getFileContent(actual, 'app/api/account/export/route.ts')
const exportButton = (actual: string) => getFileContent(actual, 'app/account/export-button.tsx')

export const graders = defineGraders({
  export_route_file: async (actual) => exportRoute(actual) !== null,
  export_button_file: async (actual) => exportButton(actual) !== null,
  imports_server_reverification: async (actual) =>
    /import\s*\{[^}]*\bauth\b[^}]*\breverificationErrorResponse\b[^}]*\}\s*from\s*['"]@clerk\/nextjs\/server['"]/.test(
      exportRoute(actual) ?? '',
    ) ||
    /import\s*\{[^}]*\breverificationErrorResponse\b[^}]*\bauth\b[^}]*\}\s*from\s*['"]@clerk\/nextjs\/server['"]/.test(
      exportRoute(actual) ?? '',
    ),
  reads_has_from_auth: async (actual) =>
    /const\s*\{[^}]*\bhas\b[^}]*\}\s*=\s*await\s+auth\s*\(\s*\)/.test(exportRoute(actual) ?? ''),
  requires_strict_reverification: async (actual) =>
    /\bhas\s*\(\s*\{\s*reverification\s*:\s*['"]strict['"]\s*\}\s*\)/.test(
      exportRoute(actual) ?? '',
    ),
  returns_clerk_reverification_response: async (actual) =>
    /return\s+reverificationErrorResponse\s*\(\s*['"]strict['"]\s*\)/.test(
      exportRoute(actual) ?? '',
    ),
  imports_use_reverification: async (actual) =>
    /import\s*\{[^}]*\buseReverification\b[^}]*\}\s*from\s*['"]@clerk\/nextjs['"]/.test(
      exportButton(actual) ?? '',
    ),
  wraps_post_request: async (actual) =>
    /useReverification\s*\(\s*(?:async\s*)?\([^)]*\)\s*=>[\s\S]*?fetch\s*\(\s*['"]\/api\/account\/export['"][\s\S]*?method\s*:\s*['"]POST['"]/.test(
      exportButton(actual) ?? '',
    ),
})
