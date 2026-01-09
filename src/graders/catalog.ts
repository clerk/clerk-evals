import { registerJudges } from '@/src/graders'

export const llmChecks = registerJudges({
  packageJsonClerkVersion:
    "Does the content contain a package.json codeblock, and does it specify @clerk/nextjs version >= 6.0.0 OR equal to 'latest'?",
  environmentVariables:
    'Does the content contain a .env.local codeblock, and does it specify CLERK_SECRET_KEY and NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?',
})

/**
 * Shared UI component assertions for Auth verticals
 */
export const authUIChecks = registerJudges({
  usesSignInComponent:
    'Does the solution use the <SignIn> or <SignIn /> component from @clerk/nextjs?',
  usesSignUpComponent:
    'Does the solution use the <SignUp> or <SignUp /> component from @clerk/nextjs?',
  usesUserButton:
    'Does the solution render a <UserButton> or <UserButton /> component from @clerk/nextjs?',
  usesSignedIn:
    'Does the solution use the <SignedIn> component to conditionally render content for authenticated users?',
  usesSignedOut:
    'Does the solution use the <SignedOut> component to conditionally render content for unauthenticated users?',
})

/**
 * Shared UI component assertions for Billing verticals
 */
export const billingUIChecks = registerJudges({
  usesCheckoutProvider: 'Does the solution use <CheckoutProvider> from @clerk/nextjs/experimental?',
  usesPaymentElement:
    'Does the solution use <PaymentElement> and <PaymentElementProvider> components?',
  usesPricingTable:
    'Does the solution use the <PricingTable> component for displaying pricing plans?',
})

/**
 * Shared UI component assertions for Organizations verticals
 */
export const organizationsUIChecks = registerJudges({
  usesOrganizationSwitcher:
    'Does the solution use the <OrganizationSwitcher> component from @clerk/nextjs?',
  usesOrganizationProfile:
    'Does the solution use the <OrganizationProfile> component from @clerk/nextjs?',
  usesOrganizationList:
    'Does the solution use the <OrganizationList> component from @clerk/nextjs?',
  usesCreateOrganization:
    'Does the solution use the <CreateOrganization> component from @clerk/nextjs?',
})

/**
 * Shared UI component assertions for UI Components vertical
 * Tests appearance customization and component composition patterns
 */
export const uiComponentChecks = registerJudges({
  usesAppearanceProp:
    'Does the solution use the appearance prop to customize Clerk component styling?',
  usesVariablesCustomization:
    'Does the solution customize component colors or styling using the variables property of the appearance prop?',
  usesElementsCustomization:
    'Does the solution customize specific elements using the elements property of the appearance prop with CSS classes or styles?',
  usesLayoutCustomization:
    'Does the solution use the layout property for logo, social button configuration, or other structural customization?',
  usesCustomMenuItem:
    'Does the solution add custom menu items to UserButton using UserButton.MenuItems, UserButton.Action, or UserButton.Link?',
  usesUserProfile: 'Does the solution use the <UserProfile> component from @clerk/nextjs?',
})
