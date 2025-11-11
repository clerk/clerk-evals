import { contains, containsAny, defineGraders, judge } from '@/src/graders'

export const graders = defineGraders({
  configures_auth_providers: containsAny(['authProviders', 'auth providers']),
  uses_auth_provider_enum: contains('AuthProvider'),
  mentions_email_auth: containsAny(['AuthProvider.EMAIL', 'email auth', 'EMAIL']),
  mentions_social_auth: containsAny([
    'AuthProvider.GOOGLE',
    'AuthProvider.FACEBOOK',
    'AuthProvider.TWITTER',
    'GOOGLE',
    'social',
  ]),
  mentions_guest_auth: containsAny(['AuthProvider.GUEST', 'GUEST', 'guest']),
  mentions_wallet_auth: containsAny(['AuthProvider.WALLET', 'WALLET', 'wallet auth']),
  has_ui_config: contains('uiConfig'),
  uses_openfort_button: containsAny(['OpenfortButton', 'openfort button']),
  demonstrates_auth_state: judge(
    'Does the code demonstrate how to check or access authentication state using hooks or similar methods?',
  ),
  shows_login_logout: judge('Does the code show or explain how users can log in and log out?'),
})
