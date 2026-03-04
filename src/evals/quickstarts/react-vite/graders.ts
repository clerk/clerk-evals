import { contains, defineGraders, not } from '@/src/graders'

export const graders = defineGraders({
  // Correct package
  clerk_react_package: contains('@clerk/clerk-react'),

  // ClerkProvider setup
  clerk_provider_usage: contains('<ClerkProvider'),
  main_file: contains('main.tsx'),
  publishable_key_prop: contains('publishableKey'),

  // Correct Vite environment variable
  vite_env_var: contains('VITE_CLERK_PUBLISHABLE_KEY'),
  import_meta_env: contains('import.meta.env'),

  // UI components
  uses_signed_in: contains('<SignedIn'),
  uses_signed_out: contains('<SignedOut'),
  uses_sign_in_button: contains('<SignInButton'),
  uses_user_button: contains('<UserButton'),

  // Deprecated patterns should NOT appear
  no_frontend_api: not(contains('frontendApi')),
  no_react_app_env: not(contains('REACT_APP_')),
})
