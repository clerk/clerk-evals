import { contains, containsAny, defineGraders, judge } from '@/src/graders'

export const graders = defineGraders({
  uses_nav_host: contains('NavHost'),

  defines_deep_links: containsAny(['navDeepLink', 'NavDeepLink']),

  intent_filter_in_manifest: containsAny(['<intent-filter', 'intent-filter']),

  uses_myapp_scheme: contains('myapp://'),

  gates_on_initialization: containsAny([
    'isInitialized',
    'isLoaded',
    'isSignedIn',
    'isClerkLoaded',
  ]),

  clears_backstack_on_redirect: containsAny(['popUpTo(', 'PopUpTo(']),

  saves_intended_destination: judge({
    criteria:
      'Does the code save the intended deep link destination before redirecting to sign-in, and pass it forward so it can be used after successful authentication?',
    examples:
      'PASS: Code stores the deep link URI in a variable like `savedDeepLink` or `pendingDestination` before redirecting to sign-in. After auth succeeds, it reads the saved value and navigates there.\nPASS: SignIn composable accepts a `redirectTo: String?` parameter. After successful sign-in, it calls `navController.navigate(redirectTo ?: "dashboard")`.\nPASS: Code passes `redirectDestination = initialDeepLink` to the SignIn screen, preserving the intended destination through the auth flow.\nPASS: A `var intendedDestination by remember { mutableStateOf<String?>(null) }` stores the deep link destination before auth redirect.\nFAIL: Code handles deep links for initial routing but loses the destination when redirecting unauthenticated users to sign-in — after sign-in, it always navigates to dashboard with no way to reach the original destination.\nFAIL: No variable, parameter, or state holds the deep link destination — the destination is simply discarded on redirect.',
  }),

  uses_launched_effect_for_nav: contains('LaunchedEffect'),

  admin_role_check: judge({
    criteria:
      "Does the code check the user's role from publicMetadata before allowing access to the admin screen, and show a Toast or redirect when the user lacks admin privileges?",
    examples:
      'PASS: Admin composable reads `user.publicMetadata` as a Map, gets the "role" key, and if role != "admin", shows `Toast.makeText(context, "Access denied. Admin role required.", Toast.LENGTH_LONG).show()` then calls `navController.popBackStack()`.\nPASS: A LaunchedEffect checks publicMetadata["role"] and navigates away with a snackbar message if not admin.\nFAIL: Admin screen renders for all authenticated users with no role check on publicMetadata.\nFAIL: Code checks a hardcoded user ID instead of reading the role from publicMetadata.',
  }),

  profile_shows_user_info: judge({
    criteria:
      "Does the Profile screen display the user's name and email from Clerk, plus a sign-out button?",
    examples:
      'PASS: Profile composable reads clerk.user and renders Text(user.firstName + " " + user.lastName), Text(user.emailAddresses.first()), and Button("Sign Out") { clerk.signOut() }.\nPASS: Code displays a Card with user.fullName, user.primaryEmailAddress?.emailAddress, and an OutlinedButton for sign-out.\nFAIL: Profile screen shows only "Profile" as a title with no user-specific data from Clerk.\nFAIL: Profile displays user info but has no sign-out button — users cannot log out from this screen.',
  }),

  single_nav_controller: judge({
    criteria:
      'Does the code create a single NavController instance (via rememberNavController) and pass it to child composables, rather than creating multiple instances?',
    examples:
      'PASS: One `val navController = rememberNavController()` in the top-level composable (e.g., MainScreen or App), passed as a parameter to NavHost and child screens.\nPASS: NavController created once at the Activity level and threaded through the composable tree via parameter.\nFAIL: Multiple composables each call `rememberNavController()` independently, creating separate navigation stacks.\nFAIL: Each screen creates its own NavController instance in its composable body.',
  }),
})
