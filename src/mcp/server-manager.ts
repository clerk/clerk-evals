import path from 'node:path'
import type { Subprocess } from 'bun'

// Path from clerk-evals/src/mcp/ to cloudflare-workers/workers/remote-mcp-server
// 3 levels up: src/mcp -> src -> clerk-evals -> Clerk (parent dir)
const MCP_SERVER_PATH = path.resolve(import.meta.dir, '../../..', 'cloudflare-workers')
const MCP_WORKER_PATH = 'workers/remote-mcp-server'
const DEFAULT_PORT = 8787
const LOCAL_URL = `http://localhost:${DEFAULT_PORT}/mcp`
const HEALTH_URL = `http://localhost:${DEFAULT_PORT}/`

// Allow remote MCP server via env var (e.g., https://mcp.clerk.dev/mcp)
const MCP_SERVER_URL = process.env.MCP_SERVER_URL || LOCAL_URL
const IS_REMOTE = MCP_SERVER_URL !== LOCAL_URL

export type MCPServerManager = {
  start(): Promise<string>
  stop(): Promise<void>
  getUrl(): string
  isRunning(): boolean
}

async function waitForServer(url: string, timeoutMs: number): Promise<boolean> {
  const startTime = Date.now()
  while (Date.now() - startTime < timeoutMs) {
    try {
      const response = await fetch(url)
      if (response.ok) {
        return true
      }
    } catch {
      // Server not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  return false
}

async function isServerRunning(): Promise<boolean> {
  try {
    const response = await fetch(HEALTH_URL)
    return response.ok
  } catch {
    return false
  }
}

export function createMCPServerManager(): MCPServerManager {
  let serverProcess: Subprocess | null = null
  const serverUrl = MCP_SERVER_URL
  let running = false

  return {
    async start(): Promise<string> {
      if (running) {
        return serverUrl
      }

      // For remote servers, just mark as running (no local process to manage)
      if (IS_REMOTE) {
        console.log(`Using remote MCP server at ${serverUrl}`)
        running = true
        return serverUrl
      }

      // Check if server is already running externally
      if (await isServerRunning()) {
        console.log(`MCP server already running at ${serverUrl}`)
        running = true
        return serverUrl
      }

      const workerDir = path.join(MCP_SERVER_PATH, MCP_WORKER_PATH)
      console.log(`Starting MCP server from: ${workerDir}`)

      // Use Bun to run serve-local.ts directly (avoids Cloudflare Workers timeout)
      serverProcess = Bun.spawn(['bun', 'serve-local.ts'], {
        cwd: workerDir,
        stdout: 'inherit',
        stderr: 'inherit',
        env: {
          ...process.env,
          CLERK_SECRET_KEY: process.env.MCP_CLERK_SECRET_KEY || process.env.CLERK_SECRET_KEY,
        },
      })

      // Wait for server to be ready by polling health endpoint
      console.log('Waiting for MCP server to be ready...')
      const isReady = await waitForServer(HEALTH_URL, 30000)

      if (!isReady) {
        serverProcess.kill()
        throw new Error('MCP server failed to start within 30 seconds')
      }

      running = true
      console.log(`MCP server ready at ${serverUrl}`)
      return serverUrl
    },

    async stop(): Promise<void> {
      // For remote servers, nothing to stop
      if (IS_REMOTE) {
        console.log('Remote MCP server - nothing to stop')
        running = false
        return
      }

      if (serverProcess && running) {
        console.log('Stopping MCP server...')
        serverProcess.kill()
        running = false
        serverProcess = null
        // Give it a moment to clean up
        await new Promise((resolve) => setTimeout(resolve, 500))
        console.log('MCP server stopped')
      } else if (running && !serverProcess) {
        // Server was already running externally, don't try to stop it
        console.log('MCP server was running externally, not stopping it')
        running = false
      }
    },

    getUrl(): string {
      return serverUrl
    },

    isRunning(): boolean {
      return running
    },
  }
}

// Singleton for sharing across the process
let globalManager: MCPServerManager | null = null

export function getGlobalMCPManager(): MCPServerManager {
  if (!globalManager) {
    globalManager = createMCPServerManager()
  }
  return globalManager
}
