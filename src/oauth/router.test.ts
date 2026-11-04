import { createHash } from 'node:crypto';
import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mcpAuthRouter } from '@modelcontextprotocol/sdk/server/auth/router.js';
import type { OAuthServerProvider } from '@modelcontextprotocol/sdk/server/auth/provider.js';
import type { OAuthClientInformationFull } from '@modelcontextprotocol/sdk/shared/auth.js';

const client: OAuthClientInformationFull = {
  client_id: 'public-client',
  client_id_issued_at: 1,
  redirect_uris: ['http://127.0.0.1/callback'],
  token_endpoint_auth_method: 'none',
  grant_types: ['authorization_code', 'refresh_token'],
  response_types: ['code'],
};

const verifier = 'abcdefghijklmnopqrstuvwxyz-ABCDEFGHIJKLMNOPQRSTUVWXYZ-0123456789';
const challenge = createHash('sha256').update(verifier).digest('base64url');

const makeApp = () => {
  const exchangeAuthorizationCode = vi.fn().mockResolvedValue({
    access_token: 'mcp_access_token',
    token_type: 'Bearer',
    expires_in: 300,
    scope: 'demo:read',
  });
  const authorize = vi.fn();
  const provider: OAuthServerProvider = {
    clientsStore: {
      getClient: vi.fn(async (clientId) => clientId === client.client_id ? client : undefined),
      registerClient: vi.fn(),
    },
    authorize,
    challengeForAuthorizationCode: vi.fn().mockResolvedValue(challenge),
    exchangeAuthorizationCode,
    exchangeRefreshToken: vi.fn(),
    verifyAccessToken: vi.fn(),
    revokeToken: vi.fn(),
  };
  const app = express();
  app.use(mcpAuthRouter({
    provider,
    issuerUrl: new URL('https://mcp.example.test'),
    resourceServerUrl: new URL('https://mcp.example.test/mcp'),
    scopesSupported: ['demo:read'],
  }));
  return { app, authorize, exchangeAuthorizationCode };
};

describe('standard MCP OAuth routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('publishes authorization and protected-resource metadata', async () => {
    const { app } = makeApp();
    const authorization = await request(app).get('/.well-known/oauth-authorization-server');
    expect(authorization.status).toBe(200);
    expect(authorization.body).toMatchObject({
      issuer: 'https://mcp.example.test/',
      authorization_endpoint: 'https://mcp.example.test/authorize',
      token_endpoint: 'https://mcp.example.test/token',
      registration_endpoint: 'https://mcp.example.test/register',
      revocation_endpoint: 'https://mcp.example.test/revoke',
      code_challenge_methods_supported: ['S256'],
    });

    const resource = await request(app).get('/.well-known/oauth-protected-resource/mcp');
    expect(resource.status).toBe(200);
    expect(resource.body).toMatchObject({
      resource: 'https://mcp.example.test/mcp',
      authorization_servers: ['https://mcp.example.test/'],
      scopes_supported: ['demo:read'],
    });
  });

  it('rejects an unknown client and an unregistered redirect before login', async () => {
    const { app, authorize } = makeApp();
    const base = {
      response_type: 'code',
      code_challenge: challenge,
      code_challenge_method: 'S256',
      scope: 'demo:read',
    };

    const unknownClient = await request(app)
      .get('/authorize')
      .query({
        ...base,
        client_id: 'unknown-client',
        redirect_uri: client.redirect_uris[0],
      });
    expect(unknownClient.status).toBe(400);

    const wrongRedirect = await request(app)
      .get('/authorize')
      .query({
        ...base,
        client_id: client.client_id,
        redirect_uri: 'https://evil.example.test/callback',
      });
    expect(wrongRedirect.status).toBe(400);
    expect(authorize).not.toHaveBeenCalled();
  });

  it('checks PKCE before exchanging an authorization code', async () => {
    const { app, exchangeAuthorizationCode } = makeApp();
    const wrong = await request(app)
      .post('/token')
      .type('form')
      .send({
        grant_type: 'authorization_code',
        client_id: client.client_id,
        code: 'oauth_code_one',
        code_verifier: `${verifier}wrong`,
        redirect_uri: client.redirect_uris[0],
      });
    expect(wrong.status).toBe(400);
    expect(wrong.body.error).toBe('invalid_grant');
    expect(exchangeAuthorizationCode).not.toHaveBeenCalled();

    const correct = await request(app)
      .post('/token')
      .type('form')
      .send({
        grant_type: 'authorization_code',
        client_id: client.client_id,
        code: 'oauth_code_one',
        code_verifier: verifier,
        redirect_uri: client.redirect_uris[0],
      });
    expect(correct.status).toBe(200);
    expect(correct.body.access_token).toBe('mcp_access_token');
  });
});
