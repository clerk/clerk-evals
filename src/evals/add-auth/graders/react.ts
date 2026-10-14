import { contains, containsAny, defineGraders, judge, matches, not } from '@/src/graders'
import { ranClerkInit } from './init-command'

export const graders = defineGraders({
  // Plain React has no accountless keys, so skip the claim-flow judge from setup-flow.ts.
  runs_clerk_init: ranClerkInit,
  clerk_react_package: contains('@clerk/react'),
  clerk_provider_usage: contains('<ClerkProvider'),
  main_file: containsAny(['main.tsx', 'main.jsx']),
  uses_signed_in: matches(/<Show\s+when=["']signed-in["']/),
  uses_signed_out: matches(/<Show\s+when=["']signed-out["']/),
  uses_sign_in_button: contains('<SignInButton'),
  uses_user_button: contains('<UserButton'),
  no_legacy_package: not(matches(/from\s+["']@clerk\/clerk-react["']/)),
  no_removed_components: not(matches(/<\/?Signed(?:In|Out)\b/)),
  no_deprecated_patterns: judge(
    'Does the solution avoid deprecated patterns like frontendApi or REACT_APP_ variables in its code? It is OK to mention deprecated patterns in warnings — only fail if the code actually uses them.',
  ),
})
