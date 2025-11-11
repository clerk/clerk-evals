import { contains, defineGraders } from '@/src/graders'

export const graders = defineGraders({
  mentions_openfort_pkg: contains('@openfort/react'),
  uses_wagmi: contains('wagmi'),
  uses_viem: contains('viem'),
  configures_providers: contains('OpenfortProvider'),
  // Add more graders specific to your evaluation
})
