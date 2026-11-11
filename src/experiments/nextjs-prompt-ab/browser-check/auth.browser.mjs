import { setupClerkTestingToken } from '@clerk/testing/playwright'
import { expect, test } from '@playwright/test'

test('renders sign-in and completes a test sign-up', async ({ page }) => {
  await setupClerkTestingToken({ page })

  await page.goto('/')
  await expect(page.getByRole('button', { name: /^sign in$/i })).toBeVisible()

  await page.goto('/sign-up')
  await expect(page.locator('.cl-signUp-root')).toBeVisible()

  const suffix = Date.now().toString(36)
  const optionalFields = [
    ['firstName', 'Test'],
    ['lastName', 'User'],
    ['username', `testuser${suffix}`],
    ['password', `TestPassword${suffix}A1!`],
    ['phoneNumber', '+12015550100'],
  ]
  for (const [name, value] of optionalFields) {
    const input = page.locator(`input[name="${name}"]`)
    if (await input.isVisible()) await input.fill(value)
  }

  const email = `testuser+clerk_test_${suffix}@example.com`
  await page.locator('input[name="emailAddress"]').fill(email)
  const legalAcceptance = page.locator('input[name="legalAccepted"]')
  if (await legalAcceptance.isVisible()) await legalAcceptance.check()

  await Promise.all([
    page.waitForResponse(
      (response) => response.url().includes('prepare_verification') && response.ok(),
    ),
    page.getByRole('button', { name: 'Continue', exact: true }).click(),
  ])
  await page.getByRole('textbox', { name: 'Enter verification code' }).pressSequentially('424242')
  await expect
    .poll(() => page.evaluate(() => Boolean(globalThis.Clerk?.user?.id)), { timeout: 30_000 })
    .toBe(true)
  console.log(`Test sign-up created ${email}`)
})
