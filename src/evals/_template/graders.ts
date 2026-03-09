import { contains, defineGraders } from '@/src/graders'
import { llmChecks } from '@/src/graders/catalog'

export const graders = defineGraders({
  mentions_openfort_pkg: contains('@openfort/openfort-node'),
  env_vars_present: llmChecks.environmentVariables,
  openfort_deps_ok: llmChecks.packageJsonOpenfortDeps,
})
