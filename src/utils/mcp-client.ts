/**
 * Shared MCP client utility for creating and connecting to MCP servers.
 */
import {
  createMCPClient as createAISDKMCPClient,
  type MCPClient as AISDKMCPClient,
} from '@ai-sdk/mcp'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'

export type MCPClient = AISDKMCPClient

/**
 * Create and connect to an MCP server via HTTP transport.
 * Returns the client and available tools.
 */
export async function createMCPClient(mcpServerUrl: string) {
  const transport = new StreamableHTTPClientTransport(new URL(mcpServerUrl))
  const client = await createAISDKMCPClient({ transport })
  const tools = await client.tools()
  return { client, tools }
}
