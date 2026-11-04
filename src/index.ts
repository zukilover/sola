export {
  bindCatalogTools,
  compileServer,
  confirmWrite,
  describeWrite,
  getToolSchema,
  invokeTool,
  ownsWrite,
  type CatalogHttpClient,
  type CatalogHttpRequest,
  type CatalogTool,
  type FieldMapper,
  type ToolContext,
  type WriteConfig,
} from './catalog/compile';
export { mappedStringInput } from './catalog/mappedStringInput';
export { WRITE_META, writeMetaInput, writeMetaSchema } from './catalog/writeMeta';
export {
  DISCOVERY_SERVER_LIMIT,
  DISCOVERY_TOOL_LIMIT,
  DISCOVERY_TOOL_NAMES,
  discoverServers,
  discoverTools,
  isDiscoveryToolName,
  matchesQuery,
} from './discovery';
export {
  clipResult,
  failure,
  INVOKE_RESULT_MAX_CHARS,
  success,
  type StructuredResult,
} from './mcpResult';
export { createSolaMcpServer, SOLA_MCP_INSTRUCTIONS, type SolaMcpHost } from './mcp';
export { attachSola, handleSolaMcpRequest, type SolaAttachOptions, type SolaTransportOptions } from './http';
export {
  SolaOAuthProvider,
  connectedPage,
  loginPage,
  loginPageHeaders,
} from './oauth/provider';
export type {
  SolaClaimedRefreshGrant,
  SolaConsumedAuthorization,
  SolaOAuthClient,
  SolaOAuthRuntime,
  SolaSessionRuntime,
} from './oauth/ports';
export { connectSolaTestClient, type SolaTestClient } from './testing';
export {
  advertisedScopes,
  authForScopes,
  cancelledWriteMessage,
  findAuth,
  findCatalog,
  findCatalogWrite,
  findRegistryWrite,
  hostIdentity,
  hostLogin,
  installedRegistries,
  logins,
  registryRouters,
  rejectedScopeMessage,
  scopeAllowed,
  useHostIdentity,
  useRegistries,
  writeScopeNames,
} from './plugins';
export { isRegistryToolEnabled } from './registry/enabled';
export {
  registryClientSchema,
  registrySchema,
  registryScopeSchema,
  registryServerSchema,
  registryToolSchema,
  type McpRegistry,
  type RegistryServer,
  type RegistryTool,
} from './registry/schema';
export {
  CatalogSignInError,
  type Catalog,
  type CatalogCredential,
  type CatalogSignIn,
  type LegacySessionBinding,
  type LoginPage,
  type McpSession,
  type ProductRegistry,
  type RegistryAuth,
  type ToolResult,
  type WritePayload,
  type WritePrompt,
  type WriteRuntime,
} from './types';
