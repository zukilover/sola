# Sola

Sola is a catalog runtime for [MCP](https://modelcontextprotocol.io/). You define the backend operations a model may call; Sola serves them from one Streamable HTTP endpoint.

Clients get four tools: `discover_servers`, `discover_tools`, `get_tool_schema`, and `invoke_tool`. Product operations live in registries you install.

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

`attachSola` mounts `/mcp` and the OAuth 2.1 / PKCE routes. Pass a `SolaSessionRuntime` and a `SolaOAuthRuntime`.

`transport: { sse: false }` is for request/response hosts. Clients POST to `/mcp`.

A client signs in, then calls `discover_servers`, `discover_tools`, and `invoke_tool`.

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

Sola uses [Semantic Versioning](https://semver.org/). Releases are listed in [CHANGELOG.md](./CHANGELOG.md).

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

```bash
npm ci
npm run typecheck
npm test
```

`npm ci` compiles `src/` to `dist/` via `prepare`. CI runs those checks on push and pull request. A GitHub Release for tag `vX.Y.Z` publishes that version to npm.

## License

[MIT](./LICENSE)
