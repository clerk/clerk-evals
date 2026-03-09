import { registerJudges } from '@/src/graders'

/**
 * Shared assertions for Openfort SDK setup
 */
export const llmChecks = registerJudges({
  packageJsonOpenfortDeps:
    "Does the content contain a package.json codeblock that includes @openfort/openfort-node or @openfort/openfort-js or @openfort/react as a dependency?",
  environmentVariables:
    'Does the content contain a .env.local codeblock that specifies OPENFORT_SECRET_KEY and NEXT_PUBLIC_OPENFORT_PUBLISHABLE_KEY (or OPENFORT_PUBLISHABLE_KEY)?',
})

/**
 * Shared assertions for wallet operations
 */
export const walletChecks = registerJudges({
  usesCreateWallet:
    'Does the solution call createWallet or openfort.wallets.create to create an embedded wallet?',
  usesSendTransaction:
    'Does the solution call sendTransaction or openfort.transactions.send to send a blockchain transaction?',
  usesWriteContract:
    'Does the solution call writeContract or interact with a smart contract via Openfort?',
})

/**
 * Shared assertions for provider setup
 */
export const providerChecks = registerJudges({
  usesOpenfortProvider:
    'Does the solution wrap the app with <OpenfortProvider> or configure OpenfortProvider?',
  usesWagmiProvider:
    'Does the solution set up <WagmiProvider> for blockchain interactions?',
  usesQueryClientProvider:
    'Does the solution set up <QueryClientProvider> from @tanstack/react-query?',
})

/**
 * Shared assertions for fee sponsorship / transaction intents
 */
export const sponsorshipChecks = registerJudges({
  usesFeeSponsorship:
    'Does the solution create a fee sponsorship using feeSponsorship.create or a policy-based sponsorship?',
  usesTransactionIntent:
    'Does the solution create a transaction intent using transactionIntents.create or openfort.transactionIntents?',
  usesPolicyId:
    'Does the solution reference a policy ID (OPENFORT_POLICY_ID or policyId) for sponsoring transactions?',
})

/**
 * Shared assertions for SDK initialization
 */
export const setupChecks = registerJudges({
  initializesOpenfort:
    'Does the solution initialize the Openfort SDK (e.g., new Openfort(...) or Openfort.init(...))?',
  usesServerSideKey:
    'Does the solution use OPENFORT_SECRET_KEY (or a server-side secret key) for backend operations?',
})
