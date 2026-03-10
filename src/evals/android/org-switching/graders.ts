import { contains, containsAny, defineGraders, judge, matches } from '@/src/graders'

export const graders = defineGraders({
  initializes_in_application_class: matches(/class\s+\w+.*Application/),

  reads_org_memberships: containsAny([
    'organizationMemberships',
    'organization_memberships',
    'getOrganizationMemberships',
  ]),

  calls_set_active: containsAny([
    'setActive',
    'switchOrganization',
    'setActiveOrganization',
  ]),

  uses_stateflow: containsAny(['MutableStateFlow', 'StateFlow']),

  displays_org_list_with_roles: judge({
    criteria:
      "Does the code render a list showing each organization's name AND the user's role in that organization (not just the org name)?",
    examples:
      'PASS: LazyColumn iterates over organizationMemberships and each item renders Text(membership.organization.name) alongside Text("Role: ${membership.role}").\nPASS: OrgCard composable receives an OrganizationMembership and displays both org.name and membership.role in a Row.\nFAIL: List shows only organization names with no role information — just a list of org.name strings.\nFAIL: Code fetches memberships but only displays org IDs without names or roles.',
  }),

  shows_active_org_reactively: contains('collectAsState'),

  syncs_backend_context: judge({
    criteria:
      'When the active organization changes, does the code call a Clerk SDK method like setActiveOrganization(orgId) or setActive(orgId), OR update a header/token/displayed context with the org ID for backend API calls?',
    examples:
      'PASS: Code calls `clerkManager.setActiveOrganization(organizationId)` which syncs the active org on the Clerk backend session.\nPASS: After calling setActive(orgId), code updates an "X-Organization-Id" header on the HTTP client.\nPASS: A LaunchedEffect observes the active org StateFlow and updates an auth token or request interceptor with the new org ID.\nPASS: Code displays "Active Org: $orgId" and calls a Clerk API method to set the active organization.\nFAIL: Code only updates a local ViewModel variable (`_activeOrganization.value = org`) without calling any Clerk SDK method or updating any backend-facing context.\nFAIL: Org switch only changes the UI state — no setActive, setActiveOrganization, or HTTP header update.',
  }),

  handles_empty_state: judge({
    criteria:
      'Does the code handle the case where the user has no organizations by showing a message or action, rather than a blank screen?',
    examples:
      'PASS: When organizations.isEmpty(), code renders a Column with Text("You don\'t have any organizations yet.") and possibly a "Create Organization" button.\nPASS: A when-block checks the list and shows an empty state illustration with a "Contact your admin" message.\nFAIL: When the org list is empty, the screen shows nothing — just a blank LazyColumn with no items.\nFAIL: Code does not check for empty state; the LazyColumn silently renders zero items.',
  }),

  handles_loading_state: containsAny([
    'CircularProgressIndicator',
    'LinearProgressIndicator',
    'isLoading',
  ]),

  provides_signout: containsAny(['signOut', 'SignOut', 'sign_out']),

  no_todo_placeholders: judge({
    criteria:
      'Does the code implement actual Clerk SDK calls (e.g., setActive, organizationMemberships) rather than placeholder functions with TODO comments or empty stubs?',
    examples:
      'PASS: ViewModel calls `Clerk.organization.setActive(orgId)` and reads `clerk.user.organizationMemberships` with real API interactions inside coroutine scopes.\nPASS: Repository class makes actual Clerk SDK calls wrapped in try-catch with proper error handling.\nFAIL: Functions contain `// TODO: implement org switching` with empty bodies or return hardcoded data.\nFAIL: Code defines function signatures like `suspend fun switchOrg(id: String) { }` with no implementation.',
  }),
})
