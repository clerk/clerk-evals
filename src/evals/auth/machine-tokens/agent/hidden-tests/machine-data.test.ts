import { beforeEach, describe, expect, mock, test } from 'bun:test'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

type AuthOptions = {
  acceptsToken?: unknown
}

let authOptions: AuthOptions[] = []
let authenticated = false
let clerkMiddlewareCalls = 0
let clerkMiddlewareArgs: unknown[][] = []

await mock.module('@clerk/nextjs/server', () => ({
  auth: async (options?: AuthOptions) => {
    authOptions.push(options ?? {})
    return { isAuthenticated: authenticated }
  },
  clerkMiddleware: (...args: unknown[]) => {
    clerkMiddlewareCalls += 1
    clerkMiddlewareArgs.push(args)
    return () => new Response(null, { status: 204 })
  },
}))

function workspaceModule(relativePath: string): string {
  const workspace = process.env.CLERK_EVAL_WORKSPACE
  if (!workspace) throw new Error('CLERK_EVAL_WORKSPACE is required')
  const absolutePath = path.join(workspace, relativePath)
  return `${pathToFileURL(absolutePath).href}?case=${Date.now()}-${Math.random()}`
}

async function importRoute(): Promise<{ GET: () => Promise<Response> | Response }> {
  return (await import(workspaceModule('app/api/machine-data/route.ts'))) as {
    GET: () => Promise<Response> | Response
  }
}

describe('machine token endpoint', () => {
  beforeEach(() => {
    authOptions = []
    authenticated = false
    clerkMiddlewareCalls = 0
    clerkMiddlewareArgs = []
  })

  test('accepts only Clerk API keys and machine-to-machine tokens', async () => {
    const { GET } = await importRoute()

    await GET()

    expect(authOptions).toHaveLength(1)
    expect(authOptions[0]?.acceptsToken).toEqual(['api_key', 'm2m_token'])
  })

  test('returns 401 for unauthenticated machine requests', async () => {
    const { GET } = await importRoute()

    const response = await GET()

    expect(response.status).toBe(401)
  })

  test('returns 200 for authenticated machine requests', async () => {
    authenticated = true
    const { GET } = await importRoute()

    const response = await GET()

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('application/json')
  })

  test('exports the default Clerk middleware from proxy.ts', async () => {
    const proxy = (await import(workspaceModule('proxy.ts'))) as { default?: unknown }

    expect(clerkMiddlewareCalls).toBe(1)
    expect(clerkMiddlewareArgs).toEqual([[]])
    expect(typeof proxy.default).toBe('function')
  })
})
