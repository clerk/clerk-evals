import { registerJudges } from '@/src/graders'

export const llmChecks = registerJudges({
  packageJsonOpenfortReactVersion:
    'Does the content contain a package.json codeblock, and does it specify @openfort/react as a dependency?',
  packageJsonOpenfortNodeVersion:
    'Does the content contain a package.json codeblock, and does it specify @openfort/openfort-node as a dependency?',
  frontendEnvironmentVariables:
    'Does the content reference environment variables for Openfort publishable key and shield publishable key (e.g., OPENFORT_PUBLISHABLE_KEY, OPENFORT_SHIELD_PUBLISHABLE_KEY)?',
  backendEnvironmentVariables:
    'Does the content reference environment variables for Openfort API secret key and wallet secret (e.g., OPENFORT_API_KEY, OPENFORT_WALLET_SECRET)?',
})
