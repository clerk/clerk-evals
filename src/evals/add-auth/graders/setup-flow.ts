import { judge } from '@/src/graders'
import { ranClerkInit } from './init-command'

export const setupFlowGraders = {
  runs_clerk_init: ranClerkInit,
  describes_accountless_claim_flow: judge(
    'Does the response explain that clerk init can provision an accountless, claimable application with temporary development keys and that the user can sign in later to claim it?',
  ),
}
