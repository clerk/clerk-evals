import { defineGraders, getFileContent } from '@/src/graders'

const passkeyButton = (actual: string) => getFileContent(actual, 'app/sign-in/passkey-button.tsx')

export const graders = defineGraders({
  passkey_button_file: async (actual) => passkeyButton(actual) !== null,
  client_component: async (actual) => /['"]use client['"]/.test(passkeyButton(actual) ?? ''),
  imports_use_sign_in: async (actual) =>
    /import\s*\{[^}]*\buseSignIn\b[^}]*\}\s*from\s*['"]@clerk\/nextjs['"]/.test(
      passkeyButton(actual) ?? '',
    ),
  calls_use_sign_in: async (actual) => /\buseSignIn\s*\(\s*\)/.test(passkeyButton(actual) ?? ''),
  starts_discoverable_passkey: async (actual) => {
    const file = passkeyButton(actual)
    return (
      file !== null &&
      /\bsignIn\.passkey\s*\(\s*\{[\s\S]*?flow\s*:\s*['"]discoverable['"][\s\S]*?\}\s*\)/.test(file)
    )
  },
  checks_complete_status: async (actual) =>
    /(?:signIn|result|attempt)\.status\s*={2,3}\s*['"]complete['"]/.test(
      passkeyButton(actual) ?? '',
    ),
  finalizes_sign_in: async (actual) =>
    /\bsignIn\.finalize\s*\(\s*\{[\s\S]*?navigate\s*:/.test(passkeyButton(actual) ?? ''),
  no_manual_webauthn: async (actual) => {
    const file = passkeyButton(actual)
    return file !== null && !/navigator\.credentials\.(?:get|create)\s*\(/.test(file)
  },
  no_deprecated_passkey_method: async (actual) => {
    const file = passkeyButton(actual)
    return file !== null && !/authenticateWithPasskey\s*\(/.test(file)
  },
})
