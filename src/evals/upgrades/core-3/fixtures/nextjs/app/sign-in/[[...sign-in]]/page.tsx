import { SignIn } from '@clerk/nextjs'

export default function SignInPage() {
  return <SignIn redirectUrl="/dashboard" />
}
