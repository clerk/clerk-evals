import { contains, containsAny, defineGraders, judge } from '@/src/graders'

export const graders = defineGraders({
  correctly_identifies_expo: judge(
    'Does the output correctly identify this as an Expo/React Native project and use Expo-appropriate tooling instead of native Kotlin/Jetpack Compose patterns?',
  ),

  uses_expo_sdk: containsAny(['@clerk/clerk-expo', '@clerk/expo', 'clerk/expo']),

  avoids_kotlin_patterns: judge(
    'Does the output avoid mentioning clerk-android, Jetpack Compose, Kotlin-specific patterns, or native Android implementation details?',
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
