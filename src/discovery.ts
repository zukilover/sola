import { isRegistryToolEnabled } from './registry/enabled';
import type { McpRegistry, RegistryServer, RegistryTool } from './registry/schema';

export const DISCOVERY_TOOL_NAMES = [
  'discover_servers',
  'discover_tools',
  'get_tool_schema',
  'invoke_tool',
] as const;

export const DISCOVERY_SERVER_LIMIT = 10;
export const DISCOVERY_TOOL_LIMIT = 20;

const tokens = (value: string): string[] =>
  value.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

export const matchesQuery = (haystack: string, query: string): boolean => {
  const needles = tokens(query).filter((needle) => needle.length >= 3);
  if (needles.length === 0) {
    return false;
  }
  const text = haystack.toLowerCase();
  return needles.some((needle) => text.includes(needle));
};

export const isDiscoveryToolName = (name: string): boolean =>
  (DISCOVERY_TOOL_NAMES as readonly string[]).includes(name);

const serverHaystack = (server: RegistryServer): string =>
  `${server.id} ${server.title} ${server.description} ${server.kind} ${server.owner}`;

const toolHaystack = (tool: RegistryTool): string =>
  `${tool.name} ${tool.title} ${tool.description}`;

const canSeeServer = (
  server: RegistryServer,
  scopes: readonly string[],
): boolean => server.enabled && server.access.scopes.some((scope) => scopes.includes(scope));

const serverMatchesQuery = ({
  server,
  query,
  scopes,
  writesEnabled,
  writeScopes,
  registry,
}: {
  server: RegistryServer;
  query: string;
  scopes: readonly string[];
  writesEnabled: boolean;
  writeScopes: readonly string[];
  registry: McpRegistry;
}): boolean => {
  if (matchesQuery(serverHaystack(server), query)) {
    return true;
  }
  return server.tools.some((tool) => (
    isRegistryToolEnabled({
      serverId: server.id,
      toolName: tool.name,
      scopes,
      writesEnabled,
      writeScopes,
      registry,
    }) && matchesQuery(toolHaystack(tool), query)
  ));
};

export const discoverServers = ({
  query,
  scopes,
  writesEnabled,
  writeScopes,
  registry,
}: {
  query: string;
  scopes: readonly string[];
  writesEnabled: boolean;
  writeScopes: readonly string[];
  registry: McpRegistry;
}) => {
  const servers = registry.servers
    .filter((server) => canSeeServer(server, scopes)
      && serverMatchesQuery({
        server,
        query,
        scopes,
        writesEnabled,
        writeScopes,
        registry,
      }))
    .slice(0, DISCOVERY_SERVER_LIMIT)
    .map((server) => ({
      id: server.id,
      title: server.title,
      description: server.description,
      kind: server.kind,
      owner: server.owner,
    }));

  return {
    servers,
    limit: DISCOVERY_SERVER_LIMIT,
  };
};

export const discoverTools = ({
  serverId,
  query,
  scopes,
  writesEnabled,
  writeScopes,
  registry,
}: {
  serverId: string;
  query?: string;
  scopes: readonly string[];
  writesEnabled: boolean;
  writeScopes: readonly string[];
  registry: McpRegistry;
}) => {
  const server = registry.servers.find((item) => item.id === serverId);
  if (!server || !canSeeServer(server, scopes)) {
    return {
      server_id: serverId,
      tools: [],
      limit: DISCOVERY_TOOL_LIMIT,
    };
  }

  const tools = server.tools
    .filter((tool) => isRegistryToolEnabled({
      serverId,
      toolName: tool.name,
      scopes,
      writesEnabled,
      writeScopes,
      registry,
    }))
    .filter((tool) => !query || matchesQuery(toolHaystack(tool), query))
    .slice(0, DISCOVERY_TOOL_LIMIT)
    .map((tool) => ({
      name: tool.name,
      title: tool.title,
      description: tool.description,
    }));

  return {
    server_id: serverId,
    tools,
    limit: DISCOVERY_TOOL_LIMIT,
  };
};
