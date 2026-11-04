# Sola

Sola is an [MCP](https://modelcontextprotocol.io/) gateway. A client connects to one Streamable HTTP endpoint. The model sees four tools: `discover_servers`, `discover_tools`, `get_tool_schema`, and `invoke_tool`.

You install registries of the backend operations the gateway may call. Sola checks the allowlist, then runs the matching catalog tool through `invoke_tool`.

## Install

Node.js 20+. Peer dependency: `zod`.

```bash
npm install sola zod
```

Dependencies: `@modelcontextprotocol/sdk`, `express`.

## Usage

### 1. Define a catalog

```ts
import { z } from 'zod';
import {
  bindCatalogTools,
  compileServer,
  success,
  type CatalogTool,
} from 'sola';

const ping: CatalogTool = {
  name: 'ping',
  title: 'Ping',
  description: 'Check that the demo backend is reachable',
  enabled: true,
  scopes: ['demo:read'],
  input: z.object({}).strict(),
  schema: { type: 'object', properties: {}, additionalProperties: false },
  execute: async () => success({ ok: true }),
};

const server = compileServer({
  id: 'demo',
  title: 'Demo',
  description: 'Example catalog',
  owner: 'example',
  kind: 'catalog',
  enabled: true,
  access: { scopes: ['demo:read'], clients: ['*'] },
}, [ping]);

const tools = bindCatalogTools([ping], () => ({
  request: async () => ({}),
}));

await tools.invoke({
  sessionHash: 's1',
  subject: 'user',
  credentials: {},
  scopes: ['demo:read'],
  expiresAt: Math.floor(Date.now() / 1000) + 3600,
}, 'ping', {});
```

Each tool has a public name, JSON Schema, Zod input, and either `execute` or `request` + `normalize`. If a scope ends in `:write`, add `write` metadata. Details: [spec/02-catalog.md](./spec/02-catalog.md).

### 2. Serve it

```ts
import express from 'express';
import {
  attachSola,
  findCatalog,
  useRegistries,
  writeScopeNames,
} from 'sola';

useRegistries([{
  id: 'demo',
  catalog: { id: 'demo', server, ...tools },
}]);

const app = express();
app.use(express.json());

attachSola(app, {
  publicBaseUrl: process.env.PUBLIC_BASE_URL!,
  identity: { serviceName: 'demo', resourceName: 'Demo MCP' },
  host: {
    registry: { version: '1', servers: [server] },
    writesEnabled: false,
    writeScopes: writeScopeNames(),
    getToolSchema: (serverId, toolName) =>
      findCatalog(serverId)?.getToolSchema(toolName),
    invoke: (session, serverId, toolName, raw) =>
      findCatalog(serverId)!.invoke(session, toolName, raw),
  },
  sessions, // SolaSessionRuntime: createSession, resolveSession, revokeSession
  oauth,    // SolaOAuthRuntime: clients, authorization codes, refresh grants
  transport: { sse: false },
});
```

`attachSola` is the gateway. It mounts `/mcp` and the OAuth 2.1 / PKCE routes. Pass a `SolaSessionRuntime` and a `SolaOAuthRuntime`.

`transport: { sse: false }` is for request/response hosts. Clients POST to `/mcp`.

A client signs in, then calls `discover_servers`, `discover_tools`, and `invoke_tool`. Those calls stay on the gateway. `invoke_tool` runs the matching catalog tool.

## Spec

Catalogs are TypeScript (`CatalogTool`). Full spec: [`spec/`](./spec).

| Document | Topic |
| --- | --- |
| [01-overview](./spec/01-overview.md) | Roles and MCP surface |
| [02-catalog](./spec/02-catalog.md) | Tools, codecs, HTTP steps |
| [03-discovery](./spec/03-discovery.md) | The four public tools |
| [04-writes](./spec/04-writes.md) | Confirmation and idempotency |
| [05-security](./spec/05-security.md) | Tokens and allowlisting |
| [06-adapters](./spec/06-adapters.md) | Drafting a catalog from another spec |

## Versioning

[CHANGELOG.md](./CHANGELOG.md)

## Contributing

[CONTRIBUTING.md](./CONTRIBUTING.md)

## License

[MIT](./LICENSE)
