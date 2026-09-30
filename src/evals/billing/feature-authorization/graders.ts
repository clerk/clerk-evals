import { defineGraders, getFileContent } from '@/src/graders'

const premiumRoute = (actual: string) => getFileContent(actual, 'app/api/reports/premium/route.ts')

function deniedFeatureBranch(actual: string): string | null {
  const match =
    /if\s*\(\s*!\s*has\s*\(\s*\{\s*feature\s*:\s*['"]premium_reports['"]\s*\}\s*\)\s*\)\s*\{?/.exec(
      actual,
    )
  if (!match) return null
  return actual.slice(match.index, match.index + 350)
}

export const graders = defineGraders({
  premium_report_route_file: async (actual) => premiumRoute(actual) !== null,
  imports_server_auth: async (actual) =>
    /import\s*\{[^}]*\bauth\b[^}]*\}\s*from\s*['"]@clerk\/nextjs\/server['"]/.test(
      premiumRoute(actual) ?? '',
    ),
  reads_has_from_auth: async (actual) =>
    /const\s*\{[^}]*\bhas\b[^}]*\}\s*=\s*await\s+auth\s*\(\s*\)/.test(premiumRoute(actual) ?? ''),
  checks_premium_reports_feature: async (actual) =>
    /\bhas\s*\(\s*\{\s*feature\s*:\s*['"]premium_reports['"]\s*\}\s*\)/.test(
      premiumRoute(actual) ?? '',
    ),
  denies_missing_feature_with_403: async (actual) => {
    const branch = deniedFeatureBranch(premiumRoute(actual) ?? '')
    return branch !== null && /status\s*:\s*403/.test(branch)
  },
  returns_authorized_report_with_200: async (actual) =>
    /status\s*:\s*200/.test(premiumRoute(actual) ?? ''),
})
