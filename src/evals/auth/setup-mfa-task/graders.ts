import { defineGraders, getFileContent } from '@/src/graders'

const layout = (actual: string) => getFileContent(actual, 'app/layout.tsx')
const setupPage = (actual: string) => getFileContent(actual, 'app/session-tasks/setup-mfa/page.tsx')

export const graders = defineGraders({
  layout_file: async (actual) => layout(actual) !== null,
  imports_clerk_provider: async (actual) =>
    /import\s*\{[^}]*\bClerkProvider\b[^}]*\}\s*from\s*['"]@clerk\/nextjs['"]/.test(
      layout(actual) ?? '',
    ),
  configures_setup_mfa_task: async (actual) =>
    /taskUrls\s*=\s*\{\s*\{[\s\S]*?['"]setup-mfa['"]\s*:\s*['"]\/session-tasks\/setup-mfa['"]/.test(
      layout(actual) ?? '',
    ),
  setup_mfa_page_file: async (actual) => setupPage(actual) !== null,
  imports_task_setup_mfa: async (actual) =>
    /import\s*\{[^}]*\bTaskSetupMFA\b[^}]*\}\s*from\s*['"]@clerk\/nextjs['"]/.test(
      setupPage(actual) ?? '',
    ),
  renders_task_setup_mfa: async (actual) => /<TaskSetupMFA\b/.test(setupPage(actual) ?? ''),
  redirects_to_dashboard: async (actual) =>
    /<TaskSetupMFA\b[^>]*redirectUrlComplete\s*=\s*['"]\/dashboard['"]/.test(
      setupPage(actual) ?? '',
    ),
})
