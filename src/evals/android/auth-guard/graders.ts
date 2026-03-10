import { contains, containsAny, defineGraders, judge, matches } from '@/src/graders'

export const graders = defineGraders({
  initializes_in_application_class: matches(/class\s+\w+.*Application/),

  gates_on_is_initialized: containsAny([
    'isInitialized',
    'isLoaded',
    'isSignedIn',
    'isClerkLoaded',
  ]),

  uses_sealed_class_for_auth_state: matches(/sealed\s+(class|interface)/),

  reads_public_metadata: containsAny(['publicMetadata', 'public_metadata']),

  redirects_unauthenticated: judge({
    criteria:
      'When the user is not signed in, does the code redirect them to the SignIn screen from any protected screen, rather than showing a blank or crashing?',
    examples:
      'PASS: Code checks `isSignedIn == false` or `user == null` inside a LaunchedEffect or auth observer, then calls `navController.navigate("signIn")` with backstack clearing.\nPASS: A when-block on auth state navigates to sign-in for the Unauthenticated variant.\nFAIL: Protected screens render their content without checking auth state, potentially showing stale data or crashing on null user.\nFAIL: Code checks auth state but shows a blank screen instead of redirecting.',
  }),

  permission_denied_with_go_back: judge({
    criteria:
      'Does the AdminSettings screen show a "Permission Denied" or equivalent denial message with a "Go Back" button when the user is not an admin?',
    examples:
      'PASS: AdminSettings composable checks role != "admin" and renders a Column with Text("Permission Denied") and a Button("Go Back") { navController.popBackStack() }.\nPASS: Code shows an AlertDialog with "Access Denied" title and a dismiss button that navigates back.\nFAIL: AdminSettings always renders admin content with no role check — non-admins see everything.\nFAIL: Code redirects non-admins away silently without showing any denial message or back button.',
  }),

  shows_admin_settings_items: judge({
    criteria:
      'Does the AdminSettings screen display at least 3 specific admin setting items (like "Manage Users", "Billing", "API Keys") when the user is authorized?',
    examples:
      'PASS: AdminSettings composable renders a LazyColumn with items like SettingsItem("Manage Users"), SettingsItem("Billing"), SettingsItem("API Keys"), SettingsItem("Audit Log").\nPASS: Code shows a list of Card composables, each with a distinct admin action name and icon.\nFAIL: AdminSettings shows only a "Welcome, Admin" message with no actionable items.\nFAIL: Code displays a single "Admin Panel" text with no specific setting categories.',
  }),

  uses_authview_for_signin: contains('AuthView'),

  dashboard_shows_user_info: judge({
    criteria:
      "Does the Dashboard screen display the user's name and email using data from Clerk, plus a button or link to navigate to AdminSettings?",
    examples:
      'PASS: Dashboard composable reads `clerk.user` and renders Text("${user.firstName} ${user.lastName}"), Text(user.emailAddresses.first()), and a Button("Admin Settings") { navigate("admin") }.\nPASS: Code shows a profile card with user.fullName, user.primaryEmailAddress, and an "Admin" navigation link.\nFAIL: Dashboard displays a generic "Welcome" with no user-specific data from Clerk.\nFAIL: Dashboard shows user info but has no way to navigate to AdminSettings.',
  }),

  internet_permission: contains('android.permission.INTERNET'),
})
