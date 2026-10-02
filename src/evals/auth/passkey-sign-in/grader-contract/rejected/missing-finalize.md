---
fail:
  - finalizes_sign_in
---

```tsx file="app/sign-in/passkey-button.tsx"
'use client'
import { useSignIn } from '@clerk/nextjs'

export function PasskeyButton() {
  const { signIn } = useSignIn()
  async function handleSignIn() {
    await signIn.passkey({ flow: 'discoverable' })
    if (signIn.status === 'complete') window.location.assign('/dashboard')
  }
  return <button onClick={handleSignIn}>Sign in</button>
}
```
