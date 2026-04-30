import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js"
import type { Config } from "./config.js"

export interface ServerConfig {
  name: string
  version: string
}

export function createServer(config: ServerConfig): Server {
  return new Server(
    {
      name: config.name,
      version: config.version,
    },
    {
      capabilities: {
        tools: {},
      },
    }
  )
}

export async function startServer(server: Server): Promise<void> {
  const transport = new StdioServerTransport()
  await server.connect(transport)
}

export { ListToolsRequestSchema, CallToolRequestSchema, Tool, StdioServerTransport }