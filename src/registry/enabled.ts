import type { McpRegistry } from './schema';

export const isRegistryToolEnabled = ({
  serverId,
  toolName,
  scopes,
  writesEnabled,
  writeScopes,
  registry,
}: {
  serverId: string;
  toolName: string;
  scopes: readonly string[];
  writesEnabled: boolean;
  writeScopes: readonly string[];
  registry: McpRegistry;
}): boolean => {
  const server = registry.servers.find((item) => item.id === serverId);
  if (!server?.enabled) {
    return false;
  }
  const tool = server.tools.find((item) => item.name === toolName);
  if (!tool?.enabled) {
    return false;
  }
  if (!tool.scopes.every((scope) => scopes.includes(scope))) {
    return false;
  }
  return !tool.scopes.some((scope) => writeScopes.includes(scope)) || writesEnabled;
};
