import { contains, defineGraders, judge } from '@/src/graders'
import { llmChecks } from '@/src/graders/catalog'

export const graders = defineGraders({
  import_package: contains('@clerk/nextjs/server'),
  import_function: contains('clerkMiddleware'),
  middleware_file_name: contains('middleware.ts'),
  orgs_dynamic_route: contains('app/orgs/['),
  package_json_clerk_version: llmChecks.packageJsonClerkVersion,
  environment_variables: llmChecks.environmentVariables,
  org_slug_from_await_auth: judge(
    'Does the content contain a codeblock that calls `await auth()` and accesses the `orgSlug`?',
  ),
})
