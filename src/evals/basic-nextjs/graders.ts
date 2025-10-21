import { contains, defineGraders } from '@/src/graders'
import { llmChecks } from '@/src/graders/catalog'

export const graders = defineGraders({
  import_package: contains('@clerk/nextjs/server'),
  import_function: contains('clerkMiddleware'),
  middleware_file_name: contains('middleware.ts'),
  app_router_layout: contains('app/layout.tsx'),
  package_json_clerk_version: llmChecks.packageJsonClerkVersion,
  environment_variables: llmChecks.environmentVariables,
})
