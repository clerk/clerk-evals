---
fail:
  - starts_discoverable_passkey
  - no_manual_webauthn
---

```tsx file="app/sign-in/passkey-button.tsx"
'use client'
import { useSignIn } from '@clerk/nextjs'

export function PasskeyButton() {
  const { signIn } = useSignIn()
  async function handleSignIn() {
    await navigator.credentials.get({ publicKey: {} as PublicKeyCredentialRequestOptions })
    if (signIn.status === 'complete') signIn.finalize({ navigate: window.location.assign })
  }
  return <button onClick={handleSignIn}>Sign in</button>
}
```
