import { contains, defineGraders } from '@/src/graders'
import { llmChecks } from '@/src/graders/catalog'

export const graders = defineGraders({
  mentions_clerk_pkg: contains('@clerk/nextjs'),
  middleware_file: contains('middleware.ts'),
  app_router_layout: contains('app/layout.tsx'),
  env_vars_present: llmChecks.environmentVariables,
  clerk_version_ok: llmChecks.packageJsonClerkVersion,
})
