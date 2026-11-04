import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createSolaMcpServer, type SolaMcpHost } from './mcp';
import type { McpSession } from './types';

export type SolaTestClient = {
  listTools: () => Promise<{ tools: Array<{ name: string }> }>;
  callTool: (input: {
    name: string;
    arguments?: Record<string, unknown>;
  }) => Promise<{ structuredContent?: unknown; isError?: boolean }>;
  close: () => Promise<void>;
};

export const connectSolaTestClient = async (
  session: McpSession,
  host: SolaMcpHost,
): Promise<SolaTestClient> => {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createSolaMcpServer(session, host);
  const client = new Client({ name: 'test-client', version: '1.0.0' });
  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);
  return {
    listTools: () => client.listTools(),
    callTool: async (input) => {
      const result = await client.callTool(input);
      const row = result as { structuredContent?: unknown; isError?: boolean };
      return {
        structuredContent: row.structuredContent,
        isError: row.isError,
      };
    },
    close: async () => {
      await client.close();
      await server.close();
    },
  };
};
