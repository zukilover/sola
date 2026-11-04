import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  discoverServers,
  discoverTools,
  isDiscoveryToolName,
} from './discovery';
import { clipResult, failure, success } from './mcpResult';
import { isRegistryToolEnabled } from './registry/enabled';
import type { McpRegistry } from './registry/schema';
import type { McpSession, ToolResult } from './types';

const jsonValue = z.union([z.string(), z.number(), z.boolean(), z.null()]);

export const SOLA_MCP_INSTRUCTIONS =
  'This gateway lists only discovery tools. Call discover_servers, then discover_tools, then invoke_tool. Read get_tool_schema only if needed. Never invent server ids or tool names.';

export type SolaMcpHost = {
  registry: McpRegistry;
  writesEnabled: boolean;
  writeScopes: readonly string[];
  getToolSchema: (serverId: string, toolName: string) => Record<string, unknown> | undefined;
  invoke: (
    session: McpSession,
    serverId: string,
    toolName: string,
    raw: unknown,
  ) => Promise<ToolResult>;
};

export const createSolaMcpServer = (
  session: McpSession,
  host: SolaMcpHost,
) => {
  const { registry, writesEnabled, writeScopes } = host;
  const server = new McpServer(
    {
      name: 'sola',
      version: '0.1.0',
    },
    {
      instructions: SOLA_MCP_INSTRUCTIONS,
      maxToolInputElements: 100,
    },
  );

  server.registerTool('discover_servers', {
    title: 'Discover servers',
    description: 'Find approved MCP servers from a plain-English request. Approved product tools are not listed on this server. Discover a server first, then its tools.',
    inputSchema: {
      query: z.string().trim().min(1).max(200),
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  }, async ({ query }) => success(discoverServers({
    query,
    scopes: session.scopes,
    writesEnabled,
    writeScopes,
    registry,
  })));

  server.registerTool('discover_tools', {
    title: 'Discover tools',
    description: 'Find approved tools on one registry server. Optionally filter with a plain-English request.',
    inputSchema: {
      server_id: z.string().trim().min(1).max(100),
      query: z.string().trim().min(1).max(200).optional(),
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  }, async ({ server_id, query }) => success(discoverTools({
    serverId: server_id,
    query,
    scopes: session.scopes,
    writesEnabled,
    writeScopes,
    registry,
  })));

  server.registerTool('get_tool_schema', {
    title: 'Get tool schema',
    description: 'Return one approved tool’s input format.',
    inputSchema: {
      server_id: z.string().trim().min(1).max(100),
      tool_name: z.string().trim().min(1).max(100),
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  }, async ({ server_id, tool_name }) => {
    if (isDiscoveryToolName(tool_name)) {
      return failure(new Error('Discovery tools cannot be read through get_tool_schema. Use tools/list.'));
    }
    if (!isRegistryToolEnabled({
      serverId: server_id,
      toolName: tool_name,
      scopes: session.scopes,
      writesEnabled,
      writeScopes,
      registry,
    })) {
      return failure(new Error('That tool is not available for this session'));
    }
    const listed = registry.servers.find((item) => item.id === server_id);
    const tool = listed?.tools.find((item) => item.name === tool_name);
    const inputSchema = host.getToolSchema(server_id, tool_name);
    if (!tool || !inputSchema) {
      return failure(new Error('That tool schema is not available'));
    }
    return success({
      server_id,
      tool_name,
      title: tool.title,
      description: tool.description,
      input_schema: inputSchema,
    });
  });

  server.registerTool('invoke_tool', {
    title: 'Invoke tool',
    description: 'Run one approved registry tool. Do not use this to call discovery tools.',
    inputSchema: {
      server_id: z.string().trim().min(1).max(100),
      tool_name: z.string().trim().min(1).max(100),
      arguments: z.record(z.string(), jsonValue).optional(),
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
  }, async ({ server_id, tool_name, arguments: toolArguments }) => {
    if (isDiscoveryToolName(tool_name) || isDiscoveryToolName(server_id)) {
      return failure(new Error('Nested discovery or invoke calls are not allowed'));
    }
    if (!isRegistryToolEnabled({
      serverId: server_id,
      toolName: tool_name,
      scopes: session.scopes,
      writesEnabled,
      writeScopes,
      registry,
    })) {
      return failure(new Error('That tool is not available for this session'));
    }
    return clipResult(await host.invoke(session, server_id, tool_name, toolArguments || {}));
  });

  return server;
};
