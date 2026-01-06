import { contains, defineGraders, judge } from '@/src/graders'
import { llmChecks } from '@/src/graders/catalog'

export const graders = defineGraders({
  profile_page_file: contains('app/profile/page.tsx'),
  profile_client_component_file: contains('app/profile/user-client.tsx'),
  profile_route_file: contains('app/api/profile/route.ts'),
  middleware_file: contains('middleware.ts'),
  import_current_user: contains('currentuser('),
  import_use_user: contains('useuser('),
  client_directive: contains("'use client'"),
  user_button: contains('userbutton'),
  after_sign_out_url: contains('aftersignouturl="/'),
  package_json_clerk_version: llmChecks.packageJsonClerkVersion,
  environment_variables: llmChecks.environmentVariables,
  profile_route_logic: judge(
    'Does the answer describe returning 401 JSON when no one is signed in and 200 JSON with id, firstName, and lastName when the user is present in the profile route handler?',
  ),
})
