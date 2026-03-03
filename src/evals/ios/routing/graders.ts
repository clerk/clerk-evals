import { contains, containsAny, defineGraders, judge } from '@/src/graders'

export const graders = defineGraders({
  correctly_identifies_expo: judge(
    'Does the output correctly identify this as an Expo/React Native project and use Expo-appropriate tooling instead of native Swift/ClerkKit patterns?',
  ),

  uses_expo_sdk: containsAny(['@clerk/expo', 'clerk/expo']),

  avoids_swift_patterns: judge(
    'Does the output avoid mentioning ClerkKit, ClerkKitUI, Swift-specific patterns, or native iOS implementation details?',
  ),

  uses_js_ecosystem: containsAny([
    'package.json',
    'npm',
    'yarn',
    'bun',
    'pnpm',
    'npx',
    'expo install',
  ]),

  uses_clerk_provider: contains('ClerkProvider'),
})
