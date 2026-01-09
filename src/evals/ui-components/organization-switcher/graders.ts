import { contains, containsAny, defineGraders, judge } from '@/src/graders'
import { llmChecks, organizationsUIChecks, uiComponentChecks } from '@/src/graders/catalog'

export const graders = defineGraders({
  org_switcher_component: organizationsUIChecks.usesOrganizationSwitcher,
  after_select_url: contains('afterSelectOrganizationUrl'),
  after_create_url: contains('afterCreateOrganizationUrl'),
  hide_personal: contains('hidePersonal'),
  org_slug_in_url: containsAny(['{slug}', ':slug', 'slug']),
  appearance_prop: uiComponentChecks.usesAppearanceProp,
  import_from_clerk: contains("from '@clerk/nextjs'"),
  package_json_clerk_version: llmChecks.packageJsonClerkVersion,
  environment_variables: llmChecks.environmentVariables,
  multi_tenant_nav: judge(
    'Does the solution demonstrate an OrganizationSwitcher configured for B2B multi-tenancy with URL navigation patterns using slug interpolation for organization selection and creation, and hidePersonal enabled?',
  ),
})
