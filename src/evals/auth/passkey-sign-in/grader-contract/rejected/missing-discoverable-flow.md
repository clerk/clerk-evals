---
fail:
  - starts_discoverable_passkey
---

```tsx file="app/sign-in/passkey-button.tsx"
'use client'
import { useSignIn } from '@clerk/nextjs'

export function PasskeyButton() {
  const { signIn } = useSignIn()
  async function handleSignIn() {
    await signIn.passkey({})
    if (signIn.status === 'complete') signIn.finalize({ navigate: window.location.assign })
  }
  return <button onClick={handleSignIn}>Sign in</button>
}
```
