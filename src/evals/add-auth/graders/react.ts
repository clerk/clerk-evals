import { contains, containsAny, defineGraders, not } from '@/src/graders'

export const graders = defineGraders({
  clerk_react_package: contains('@clerk/clerk-react'),
  clerk_provider_usage: contains('<ClerkProvider'),
  main_file: containsAny(['main.tsx', 'main.jsx']),
  publishable_key_prop: contains('publishableKey'),
  vite_env_var: contains('VITE_CLERK_PUBLISHABLE_KEY'),
  import_meta_env: contains('import.meta.env'),
  uses_signed_in: contains('<SignedIn'),
  uses_signed_out: contains('<SignedOut'),
  uses_sign_in_button: contains('<SignInButton'),
  uses_user_button: contains('<UserButton'),
  no_frontend_api: not(contains('frontendApi')),
  no_react_app_env: not(contains('REACT_APP_')),
})
