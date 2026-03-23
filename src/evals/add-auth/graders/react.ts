import { contains, containsAny, defineGraders, judge } from '@/src/graders'

export const graders = defineGraders({
  clerk_react_package: containsAny(['@clerk/react', '@clerk/clerk-react']),
  clerk_provider_usage: contains('<ClerkProvider'),
  main_file: containsAny(['main.tsx', 'main.jsx']),
  publishable_key_prop: contains('publishableKey'),
  vite_env_var: contains('VITE_CLERK_PUBLISHABLE_KEY'),
  uses_signed_in: contains('<SignedIn'),
  uses_signed_out: contains('<SignedOut'),
  uses_sign_in_button: contains('<SignInButton'),
  uses_user_button: contains('<UserButton'),
  no_deprecated_patterns: judge(
    'Does the solution use the correct Vite environment variable pattern (VITE_CLERK_PUBLISHABLE_KEY with import.meta.env) and avoid deprecated patterns like frontendApi or REACT_APP_ variables in its code? It is OK to mention deprecated patterns in warnings — only fail if the code actually uses them.',
  ),
})
