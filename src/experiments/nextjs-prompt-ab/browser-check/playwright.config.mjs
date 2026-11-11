import { defineConfig, devices } from '@playwright/test'

delete process.env.CLERK_PUBLISHABLE_KEY
delete process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
delete process.env.CLERK_SECRET_KEY
delete process.env.CLERK_TESTING_TOKEN
process.loadEnvFile('.env.local')

export default defineConfig({
  testDir: '.',
  timeout: 60_000,
  use: { baseURL: 'http://127.0.0.1:3100' },
  projects: [
    { name: 'setup', testMatch: /global\.setup\.mjs/ },
    {
      name: 'chromium',
      testMatch: /auth\.browser\.mjs/,
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev -- --hostname 127.0.0.1 --port 3100',
    cwd: process.cwd(),
    url: 'http://127.0.0.1:3100',
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
