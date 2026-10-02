import { beforeEach, describe, expect, mock, test } from 'bun:test'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

type ElementNode = {
  type: unknown
  props: Record<string, unknown>
}

type NavigateArgs = {
  session: unknown
  decorateUrl: (url: string) => string
}

type SetActiveOptions = {
  session?: string
  navigate?: (args: NavigateArgs) => void
  beforeEmit?: unknown
}

let setActiveCalls: SetActiveOptions[] = []
let pushedUrls: string[] = []

const jsx = (type: unknown, props: Record<string, unknown> | null): ElementNode => ({
  type,
  props: props ?? {},
})

await mock.module('react/jsx-runtime', () => ({
  Fragment: 'Fragment',
  jsx,
  jsxs: jsx,
}))

await mock.module('react/jsx-dev-runtime', () => ({
  Fragment: 'Fragment',
  jsxDEV: jsx,
}))

await mock.module('@clerk/nextjs', () => ({
  ClerkProvider: 'ClerkProvider',
  Show: 'Show',
  SignInButton: 'SignInButton',
  SignUpButton: 'SignUpButton',
  UserButton: 'UserButton',
  SignIn: 'SignIn',
  SignUp: 'SignUp',
  useClerk: () => ({
    setActive: async (options: SetActiveOptions) => {
      setActiveCalls.push(options)
    },
  }),
}))

await mock.module('next/navigation', () => ({
  useRouter: () => ({
    push: (url: string) => pushedUrls.push(url),
  }),
}))

function workspacePath(relativePath: string): string {
  const workspace = process.env.CLERK_EVAL_WORKSPACE
  if (!workspace) throw new Error('CLERK_EVAL_WORKSPACE is required')
  return path.join(workspace, relativePath)
}

function workspaceModule(relativePath: string): string {
  return `${pathToFileURL(workspacePath(relativePath)).href}?case=${Date.now()}-${Math.random()}`
}

function childNodes(value: unknown): ElementNode[] {
  if (Array.isArray(value)) return value.flatMap(childNodes)
  if (!value || typeof value !== 'object') return []

  const node = value as Partial<ElementNode>
  if (!('type' in node) || !node.props) return []
  return [node as ElementNode, ...childNodes(node.props.children)]
}

async function source(relativePath: string): Promise<string> {
  return readFile(workspacePath(relativePath), 'utf8')
}

describe('Clerk Core 3 upgrade', () => {
  beforeEach(() => {
    setActiveCalls = []
    pushedUrls = []
  })

  test('uses supported Clerk and Node versions', async () => {
    const pkg = JSON.parse(await source('package.json')) as {
      dependencies?: Record<string, string>
      engines?: Record<string, string>
    }
    const clerkVersion = pkg.dependencies?.['@clerk/nextjs'] ?? ''
    const clerkMajor = Number.parseInt(clerkVersion.match(/\d+/)?.[0] ?? '0', 10)

    expect(clerkMajor).toBeGreaterThanOrEqual(7)
    expect(pkg.engines?.node).toMatch(/20\.(?:9|[1-9]\d)|2[1-9]\./)
  })

  test('renders ClerkProvider inside body with Core 3 appearance options', async () => {
    const { default: RootLayout } = (await import(workspaceModule('app/layout.tsx'))) as {
      default: (props: { children: unknown }) => ElementNode
    }
    const layout = RootLayout({ children: 'page' })

    expect(layout.type).toBe('html')
    const body = childNodes(layout).find((node) => node.type === 'body')
    const provider = childNodes(body).find((node) => node.type === 'ClerkProvider')
    expect(provider).toBeDefined()
    expect(provider?.props.appearance).toEqual({
      options: { socialButtonsPlacement: 'bottom' },
    })
  })

  test('renders auth states and billing permission with Show', async () => {
    const { AuthControls } = (await import(workspaceModule('components/auth-controls.tsx'))) as {
      AuthControls: () => ElementNode
    }
    const nodes = childNodes(AuthControls())
    const shows = nodes.filter((node) => node.type === 'Show')

    expect(shows.some((node) => node.props.when === 'signed-out')).toBe(true)
    expect(shows.some((node) => node.props.when === 'signed-in')).toBe(true)
    expect(
      shows.some(
        (node) =>
          (node.props.when as { permission?: string } | undefined)?.permission ===
          'org:billing:manage',
      ),
    ).toBe(true)
  })

  test('keeps fallback redirects on the sign-in and sign-up pages', async () => {
    const { default: SignInPage } = (await import(
      workspaceModule('app/sign-in/[[...sign-in]]/page.tsx')
    )) as { default: () => ElementNode }
    const { default: SignUpPage } = (await import(
      workspaceModule('app/sign-up/[[...sign-up]]/page.tsx')
    )) as { default: () => ElementNode }

    expect(SignInPage().props.fallbackRedirectUrl).toBe('/dashboard')
    expect(SignUpPage().props.fallbackRedirectUrl).toBe('/welcome')
  })

  test('lists other sessions from the Core 3 session collection', async () => {
    const { getOtherSessionIds } = (await import(workspaceModule('lib/session-data.ts'))) as {
      getOtherSessionIds: (
        client: { sessions: Array<{ id: string }> },
        currentSessionId: string,
      ) => string[]
    }
    const client = {
      sessions: [{ id: 'current' }, { id: 'other' }],
      get activeSessions(): never {
        throw new Error('Core 2 activeSessions was accessed')
      },
    }

    expect(getOtherSessionIds(client, 'current')).toEqual(['other'])
  })

  test('switches sessions through navigate and uses the decorated URL', async () => {
    const { SessionSwitcher } = (await import(
      workspaceModule('components/session-switcher.tsx')
    )) as {
      SessionSwitcher: (props: { sessionId: string }) => ElementNode
    }
    const button = childNodes(SessionSwitcher({ sessionId: 'sess_other' })).find(
      (node) => node.type === 'button',
    )

    await (button?.props.onClick as (() => Promise<void>) | undefined)?.()
    expect(setActiveCalls).toHaveLength(1)
    expect(setActiveCalls[0]?.session).toBe('sess_other')
    expect(setActiveCalls[0]?.beforeEmit).toBeUndefined()
    expect(setActiveCalls[0]?.navigate).toBeFunction()

    setActiveCalls[0]?.navigate?.({
      session: { id: 'sess_other' },
      decorateUrl: (url) => `/decorated${url}`,
    })
    expect(pushedUrls).toEqual(['/decorated/dashboard'])
  })

  test('contains no Clerk Core 2 API usage', async () => {
    const files = [
      'app/layout.tsx',
      'app/sign-in/[[...sign-in]]/page.tsx',
      'app/sign-up/[[...sign-up]]/page.tsx',
      'app/billing/page.tsx',
      'components/auth-controls.tsx',
      'components/session-switcher.tsx',
      'lib/session-data.ts',
    ]
    const applicationSource = (await Promise.all(files.map(source))).join('\n')

    expect(applicationSource).not.toMatch(
      /\b(?:SignedIn|SignedOut|Protect|beforeEmit|activeSessions|afterSignInUrl|afterSignUpUrl|redirectUrl)\b|@clerk\/types/,
    )
  })
})
