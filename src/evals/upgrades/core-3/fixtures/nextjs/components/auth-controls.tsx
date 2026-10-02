'use client'

import { Protect, SignInButton, SignUpButton, SignedIn, SignedOut, UserButton } from '@clerk/nextjs'

export function AuthControls() {
  return (
    <nav aria-label="Account controls">
      <SignedOut>
        <SignInButton />
        <SignUpButton />
      </SignedOut>
      <SignedIn>
        <UserButton />
      </SignedIn>
      <Protect permission="org:billing:manage" fallback={<span>Billing access required</span>}>
        <a href="/billing">Manage billing</a>
      </Protect>
    </nav>
  )
}
