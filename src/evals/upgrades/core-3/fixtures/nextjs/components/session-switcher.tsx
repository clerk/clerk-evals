'use client'

import { useClerk } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'

export function SessionSwitcher({ sessionId }: { sessionId: string }) {
  const { setActive } = useClerk()
  const router = useRouter()

  const switchSession = async () => {
    await setActive({
      session: sessionId,
      beforeEmit: () => router.push('/dashboard'),
    })
  }

  return <button onClick={switchSession}>Switch session</button>
}
