import { ClerkProvider } from '@clerk/nextjs'
import type { ReactNode } from 'react'
import { AuthControls } from '@/components/auth-controls'

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <ClerkProvider appearance={{ layout: { socialButtonsPlacement: 'bottom' } }}>
      <html lang="en">
        <body>
          <AuthControls />
          {children}
        </body>
      </html>
    </ClerkProvider>
  )
}
