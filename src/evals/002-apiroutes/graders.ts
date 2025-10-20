import { contains, defineGraders, judge } from '@/src/graders'
import { llmChecks } from '@/src/graders/catalog'

export const graders = defineGraders({
  import_package: contains('@clerk/nextjs/server'),
  import_function: contains('clerkMiddleware'),
  middleware_file_name: contains('middleware.ts'),
  app_router_layout: contains('app/layout.tsx'),
  api_hello_route: contains('app/api/hello/route.ts'),
  package_json_clerk_version: llmChecks.packageJsonClerkVersion,
  environment_variables: llmChecks.environmentVariables,
  correct_auth_protect: judge('Does the /api/hello route call `await auth()`?'),
  current_user_helper: judge(
    "Does the /api/user route demonstrate using currentUser() from '@clerk/nextjs/server' to retrieve the current user's information in a route handler?",
  ),
})
