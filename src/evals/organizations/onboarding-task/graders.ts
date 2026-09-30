import { defineGraders, getFileContent } from '@/src/graders'

const layout = (actual: string) => getFileContent(actual, 'app/layout.tsx')
const taskPage = (actual: string) =>
  getFileContent(actual, 'app/session-tasks/choose-organization/page.tsx')

export const graders = defineGraders({
  layout_file: async (actual) => layout(actual) !== null,
  imports_clerk_provider: async (actual) =>
    /import\s*\{[^}]*\bClerkProvider\b[^}]*\}\s*from\s*['"]@clerk\/nextjs['"]/.test(
      layout(actual) ?? '',
    ),
  configures_choose_organization_task: async (actual) =>
    /taskUrls\s*=\s*\{\s*\{[\s\S]*?['"]choose-organization['"]\s*:\s*['"]\/session-tasks\/choose-organization['"]/.test(
      layout(actual) ?? '',
    ),
  choose_organization_page_file: async (actual) => taskPage(actual) !== null,
  imports_task_choose_organization: async (actual) =>
    /import\s*\{[^}]*\bTaskChooseOrganization\b[^}]*\}\s*from\s*['"]@clerk\/nextjs['"]/.test(
      taskPage(actual) ?? '',
    ),
  renders_task_choose_organization: async (actual) =>
    /<TaskChooseOrganization\b/.test(taskPage(actual) ?? ''),
  redirects_to_dashboard: async (actual) =>
    /<TaskChooseOrganization\b[^>]*redirectUrlComplete\s*=\s*['"]\/dashboard['"]/.test(
      taskPage(actual) ?? '',
    ),
  no_organization_list_substitute: async (actual) => {
    const file = taskPage(actual)
    return file !== null && !/<OrganizationList\b/.test(file)
  },
})
