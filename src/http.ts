import type { Express, Request, Response } from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  createOAuthMetadata,
  getOAuthProtectedResourceMetadataUrl,
  mcpAuthRouter,
} from '@modelcontextprotocol/sdk/server/auth/router.js';
import { requireBearerAuth } from '@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js';
import { advertisedScopes, hostIdentity } from './plugins';
import { createSolaMcpServer, type SolaMcpHost } from './mcp';
import { SolaOAuthProvider } from './oauth/provider';
import type { SolaOAuthRuntime, SolaSessionRuntime } from './oauth/ports';
import type { McpSession } from './types';

export type SolaTransportOptions = {
  sse?: boolean;
  maxRequestBodySize?: number;
};

export type SolaAttachOptions = {
  publicBaseUrl: string;
  identity?: { serviceName: string; resourceName: string };
  host: SolaMcpHost | (() => SolaMcpHost);
  sessions: SolaSessionRuntime;
  oauth: SolaOAuthRuntime;
  transport?: SolaTransportOptions;
};

const resolveHost = (host: SolaMcpHost | (() => SolaMcpHost)): SolaMcpHost =>
  typeof host === 'function' ? host() : host;

const requestSession = (req: Request): McpSession | undefined => {
  const auth = (req as Request & { auth?: { extra?: { session?: McpSession } } }).auth;
  return auth?.extra?.session;
};

export const handleSolaMcpRequest = async (
  req: Request,
  res: Response,
  session: McpSession,
  host: SolaMcpHost,
  transportOptions: SolaTransportOptions = {},
): Promise<void> => {
  if (!transportOptions.sse && (req.method === 'GET' || req.method === 'HEAD')) {
    res.status(405).set('Allow', 'POST').json({
      jsonrpc: '2.0',
      error: {
        code: -32000,
        message: 'This gateway does not keep a live event stream. Use POST for tool calls.',
      },
      id: null,
    });
    return;
  }
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
    maxRequestBodySize: transportOptions.maxRequestBodySize ?? 256 * 1024,
  });
  const server = createSolaMcpServer(session, host);
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } finally {
    await server.close();
  }
};

export const attachSola = (app: Express, options: SolaAttachOptions): void => {
  const identity = options.identity ?? hostIdentity();
  const provider = new SolaOAuthProvider({
    publicBaseUrl: options.publicBaseUrl,
    sessions: options.sessions,
    oauth: options.oauth,
  });
  const resourceUrl = new URL(`${options.publicBaseUrl}/mcp`);

  app.get('/.well-known/oauth-authorization-server', (_req, res) => {
    const metadata = createOAuthMetadata({
      provider,
      issuerUrl: new URL(options.publicBaseUrl),
      scopesSupported: advertisedScopes(),
    });
    res.status(200).json({
      ...metadata,
      revocation_endpoint_auth_methods_supported: ['none', 'client_secret_post'],
    });
  });
  app.use(mcpAuthRouter({
    provider,
    issuerUrl: new URL(options.publicBaseUrl),
    resourceServerUrl: resourceUrl,
    scopesSupported: advertisedScopes(),
    resourceName: identity.resourceName,
  }));
  app.all(
    '/mcp',
    requireBearerAuth({
      verifier: provider,
      requiredScopes: [],
      resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(resourceUrl),
      expectedResource: resourceUrl,
    }),
    async (req, res) => {
      const session = requestSession(req);
      if (!session) {
        res.status(401).json({ error: 'MCP session is invalid or expired' });
        return;
      }
      await handleSolaMcpRequest(
        req,
        res,
        session,
        resolveHost(options.host),
        options.transport,
      );
    },
  );
};
