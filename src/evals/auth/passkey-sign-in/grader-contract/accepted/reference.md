```tsx file="app/sign-in/passkey-button.tsx"
'use client'

import { useSignIn } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'

export function PasskeyButton() {
  const { signIn } = useSignIn()
  const router = useRouter()

  async function handleSignIn() {
    await signIn.passkey({ flow: 'discoverable' })
    if (signIn.status === 'complete') {
      signIn.finalize({ navigate: router.push })
    }
  }

  return <button onClick={handleSignIn}>Sign in with a passkey</button>
}
```
