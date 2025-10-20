import { registerJudges } from '@/src/graders'

export const llmChecks = registerJudges({
  packageJsonClerkVersion:
    "Does the content contain a package.json codeblock, and does it specify @clerk/nextjs version >= 6.0.0 OR equal to 'latest'?",
  environmentVariables:
    'Does the content contain a .env.local codeblock, and does it specify CLERK_SECRET_KEY and NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?',
})
