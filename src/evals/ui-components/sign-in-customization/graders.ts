import { contains, containsAny, defineGraders, judge } from '@/src/graders'
import { authUIChecks, llmChecks } from '@/src/graders/catalog'

export const graders = defineGraders({
  sign_in_component: authUIChecks.usesSignInComponent,
  catch_all_route: contains('[[...sign-in]]'),
  appearance_prop: contains('appearance={'),
  variables_color: containsAny(['colorPrimary', 'variables:']),
  variables_border: containsAny(['borderRadius', 'variables:']),
  layout_logo: containsAny(['logoImageUrl', 'layout:']),
  social_buttons_variant: containsAny(['socialButtonsVariant', 'iconButton']),
  import_from_clerk: contains("from '@clerk/nextjs'"),
  package_json_clerk_version: llmChecks.packageJsonClerkVersion,
  environment_variables: llmChecks.environmentVariables,
  customization_correct: judge(
    'Does the solution demonstrate customizing the SignIn component appearance with variables for colors/border radius and layout options for logo or social button styling?',
  ),
})
