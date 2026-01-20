import { contains, containsAny, defineGraders, judge } from '@/src/graders'
import { authUIChecks, llmChecks, uiComponentChecks } from '@/src/graders/catalog'

export const graders = defineGraders({
  settings_page: containsAny(['app/settings', 'settings/page']),
  user_profile_component: uiComponentChecks.usesUserProfile,
  routing_prop: containsAny([
    'routing="hash"',
    'routing="path"',
    "routing='hash'",
    "routing='path'",
  ]),
  appearance_elements: uiComponentChecks.usesElementsCustomization,
  dark_theme_styling: containsAny(['dark', 'gray-900', 'bg-slate', 'bg-zinc', 'bg-neutral']),
  signed_in_guard: authUIChecks.usesSignedIn,
  import_from_clerk: contains("from '@clerk/nextjs'"),
  package_json_clerk_version: llmChecks.packageJsonClerkVersion,
  environment_variables: llmChecks.environmentVariables,
  embed_correctly: judge(
    'Does the solution embed the UserProfile component inline on a settings page with custom dark theme styling using the appearance.elements API and appropriate auth guards?',
  ),
})
