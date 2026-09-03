import { contains, containsAny, defineGraders, judge, matches, not } from '@/src/graders'

export const graders = defineGraders({
  // Correct package
  clerk_react_package: contains('@clerk/react'),

  // ClerkProvider in main entry file
  clerk_provider_usage: contains('<ClerkProvider'),
  main_file: containsAny(['main.tsx', 'main.jsx']),
  publishable_key_prop: contains('publishableKey'),

  // Correct Vite environment variable
  vite_env_var: contains('VITE_CLERK_PUBLISHABLE_KEY'),
  import_meta_env: contains('import.meta.env'),

  // UI components
  uses_signed_in: matches(/<Show\s+when=["']signed-in["']/),
  uses_signed_out: matches(/<Show\s+when=["']signed-out["']/),
  uses_sign_in_button: contains('<SignInButton'),
  uses_sign_up_button: contains('<SignUpButton'),
  uses_user_button: contains('<UserButton'),

  // Deprecated patterns should NOT appear
  no_frontend_api: not(contains('frontendApi')),
  no_react_app_env: not(contains('REACT_APP_')),
  no_vite_react_app_env: not(contains('VITE_REACT_APP_')),
  no_legacy_package: not(matches(/from\s+["']@clerk\/clerk-react["']/)),
  no_removed_components: not(matches(/<\/?Signed(?:In|Out)\b/)),

  // Overall correctness: ClerkProvider wraps app at root with correct key
  setup_correct: judge(
    'Does the solution wrap the app in <ClerkProvider> at the root (main.tsx or main.jsx) using publishableKey read from import.meta.env.VITE_CLERK_PUBLISHABLE_KEY?',
  ),
})
