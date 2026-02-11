/**
 * Shared MCP client utility for creating and connecting to MCP servers.
 *
 * IMPORTANT: Uses @ai-sdk/mcp@0.0.12 due to Standard Schema compatibility.
 * Version 1.0+ requires Standard Schema which MCP servers don't provide.
 * See: https://github.com/modelcontextprotocol/typescript-sdk/issues/283
 */
import { experimental_createMCPClient } from '@ai-sdk/mcp'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'

export type MCPClient = Awaited<ReturnType<typeof experimental_createMCPClient>>

/**
 * Create and connect to an MCP server via HTTP transport.
 * Returns the client and available tools.
 */
export async function createMCPClient(mcpServerUrl: string) {
  const transport = new StreamableHTTPClientTransport(new URL(mcpServerUrl))
  const client = await experimental_createMCPClient({ transport })
  const tools = await client.tools()
  return { client, tools }
}
