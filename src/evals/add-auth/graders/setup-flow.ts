import { judge, matches } from '@/src/graders'

export const setupFlowGraders = {
  runs_clerk_init: matches(/\bnpx\s+(?:-y\s+)?clerk@latest\s+init\b/),
  describes_accountless_claim_flow: judge(
    'Does the response explain that clerk init can provision an accountless, claimable application with temporary development keys and that the user can sign in later to claim it?',
  ),
}
