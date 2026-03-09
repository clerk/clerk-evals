import { makeScorer } from '@/src/scorers/llm'

export const PATTERNS = {
  OPENFORT_NODE_IMPORT: /from ['"]@openfort\/openfort-node['"]/,
  OPENFORT_JS_IMPORT: /from ['"]@openfort\/openfort-js['"]/,
  OPENFORT_REACT_IMPORT: /from ['"]@openfort\/react['"]/,
  SDK_INITIALIZATION: /new\s+Openfort\s*\(/,
  FEE_SPONSORSHIP_CREATE: /feeSponsorship\.create\s*\(/,
  TRANSACTION_INTENT: /transactionIntents\.create\s*\(/,
  CREATE_WALLET: /createWallet|wallets\.create/,
  SEND_TRANSACTION: /sendTransaction|transactions\.send/,
}

const PROMPT_CORRECT_SDK_IMPORT =
  'Does the solution import from the correct Openfort SDK package (@openfort/openfort-node for backend, @openfort/openfort-js or @openfort/react for frontend)?'
const PROMPT_SDK_INITIALIZED = 'Does the solution correctly initialize the Openfort SDK with the appropriate API key?'
const PROMPT_POLICY_CONFIGURED =
  'Does the solution reference a policy ID for sponsoring or controlling transaction behavior?'

export const SCORERS = {
  CORRECT_SDK_IMPORT: makeScorer(PROMPT_CORRECT_SDK_IMPORT),
  SDK_INITIALIZED: makeScorer(PROMPT_SDK_INITIALIZED),
  POLICY_CONFIGURED: makeScorer(PROMPT_POLICY_CONFIGURED),
}
