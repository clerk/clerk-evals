import { contains, defineGraders, judge, matches } from '@/src/graders'
import { llmChecks } from '@/src/graders/catalog'

export const graders = defineGraders({
  admin_page_file: contains('app/admin/page.tsx'),
  admin_route_handler_file: contains('app/api/admin/route.ts'),
  middleware_file_name: contains('middleware.ts'),
  import_auth_helper: matches(/from\s+["']@clerk\/nextjs\/server["']/),
  unauthenticated_response: matches(/status:\s*401/),
  auth_protect_usage: matches(/auth\.protect\(\{\s*permission:\s*["']org:team_settings:manage["']/),
  has_permission_check: matches(/has\(\{\s*permission:\s*["']org:team_settings:manage["']/),
  package_json_clerk_version: llmChecks.packageJsonClerkVersion,
  environment_variables: llmChecks.environmentVariables,
  authorization_logic: judge(
    'Does the answer explain that the admin route returns 401 when not signed in, 403 when the permission check fails, and 200 (including the userId) when authorized?',
  ),
})
