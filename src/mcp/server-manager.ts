const DEFAULT_MCP_URL = 'http://localhost:8787/mcp'

export type MCPServerManager = {
  start(): Promise<string>
  stop(): Promise<void>
  getUrl(): string
  isRunning(): boolean
}

/**
 * Creates a simple MCP server manager that uses the MCP_SERVER_URL env var.
 * The manager does not spawn or manage the server lifecycle - it assumes
 * the server is already running at the configured URL.
 */
export function createMCPServerManager(): MCPServerManager {
  const serverUrl = process.env.MCP_SERVER_URL || DEFAULT_MCP_URL
  let running = false

  return {
    async start(): Promise<string> {
      console.log(`Using MCP server at ${serverUrl}`)
      running = true
      return serverUrl
    },

    async stop(): Promise<void> {
      running = false
    },

    getUrl(): string {
      return serverUrl
    },

    isRunning(): boolean {
      return running
    },
  }
}
