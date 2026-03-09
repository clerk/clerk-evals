import { contains, containsAny, defineGraders, judge } from '@/src/graders'

export const graders = defineGraders({
  references_openfort_react: contains('@openfort/react'),
  includes_wagmi: contains('wagmi'),
  includes_viem: contains('viem'),
  includes_tanstack_query: contains('@tanstack/react-query'),
  uses_openfort_provider: contains('OpenfortProvider'),
  uses_wagmi_provider: containsAny(['WagmiProvider']),
  uses_query_client_provider: containsAny(['QueryClientProvider']),
  configures_wagmi: containsAny(['getDefaultConfig', 'createClient', 'createConfig']),
  configures_base_sepolia: containsAny(['baseSepolia']),
  has_publishable_key: containsAny(['publishableKey', 'PUBLISHABLE_KEY']),
  has_shield_key: containsAny(['shieldPublishableKey', 'SHIELD_PUBLISHABLE_KEY']),
  mentions_providers_component: containsAny(['Providers']),
  proper_provider_hierarchy: judge(
    'Does the code demonstrate the correct provider hierarchy with WagmiProvider wrapping QueryClientProvider wrapping OpenfortProvider?',
  ),
})
