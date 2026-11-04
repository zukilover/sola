import { Router } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  InvalidGrantError,
  InvalidScopeError,
  InvalidTargetError,
} from '@modelcontextprotocol/sdk/server/auth/errors.js';
import { useRegistries } from '../plugins';
import type { Catalog, ProductRegistry, RegistryAuth } from '../types';
import { SolaOAuthProvider } from './provider';
import type { SolaOAuthRuntime, SolaSessionRuntime } from './ports';

const client = {
  client_id: 'client-one',
  client_id_issued_at: 1,
  redirect_uris: ['http://127.0.0.1/callback'],
  token_endpoint_auth_method: 'none',
  grant_types: ['authorization_code', 'refresh_token'],
  response_types: ['code'],
};

const credentials = {
  catalogId: 'demo',
  subject: 'user-1',
  accessToken: 'catalog-access',
  refreshToken: 'catalog-refresh',
  tokenType: 'Bearer',
  whitelabel: 'demo',
  expiresInSeconds: 300,
};

const refresh = vi.fn();

const demoAuth: RegistryAuth = {
  catalogId: 'demo',
  scopes: () => ['demo:read', 'demo:write'],
  allowsScope: (scope) => scope === 'demo:read' || scope === 'demo:write',
  rejectedScopeMessage: () => 'Requested scope is not available',
  loginPage: (requestId) => ({ html: `login ${requestId}`, nonce: 'nonce' }),
  loginPageHeaders: () => ({ 'X-Test': 'login' }),
  connectedPage: (origin) => ({ html: `done ${origin}`, nonce: 'nonce' }),
  refresh,
  routes: Router(),
};

const demoCatalog: Catalog = {
  id: 'demo',
  server: {
    id: 'demo',
    title: 'Demo',
    description: 'Demo catalog',
    owner: 'test',
    kind: 'catalog',
    enabled: true,
    access: { scopes: ['demo:read', 'demo:write'], clients: ['*'] },
    tools: [],
  },
  getToolSchema: () => undefined,
  invoke: async () => ({ content: [{ type: 'text', text: '{}' }], structuredContent: {} }),
};

const demoRegistry: ProductRegistry = {
  id: 'demo',
  catalog: demoCatalog,
  auth: demoAuth,
  writeScopes: ['demo:write'],
};

const oauth = {
  getClient: vi.fn(),
  saveClient: vi.fn(),
  createPendingAuthorization: vi.fn(),
  getAuthorizationCodeDetails: vi.fn(),
  consumeAuthorizationCode: vi.fn(),
  createRefreshGrant: vi.fn(),
  getRefreshGrantDetails: vi.fn(),
  claimRefreshGrant: vi.fn(),
  releaseRefreshGrant: vi.fn(),
  linkOAuthTokenPair: vi.fn(),
  revokeRefreshGrant: vi.fn(),
  revokeRefreshFamily: vi.fn(),
} as unknown as SolaOAuthRuntime & Record<string, ReturnType<typeof vi.fn>>;

const sessions = {
  createSession: vi.fn(),
  resolveSession: vi.fn(),
  revokeSession: vi.fn(),
} as unknown as SolaSessionRuntime & Record<string, ReturnType<typeof vi.fn>>;

const provider = () => new SolaOAuthProvider({
  publicBaseUrl: 'https://mcp.example.test',
  sessions,
  oauth,
});

beforeEach(() => {
  vi.resetAllMocks();
  useRegistries([demoRegistry]);
  refresh.mockResolvedValue(credentials);
  sessions.createSession.mockResolvedValue({
    accessToken: 'mcp_access',
    expiresAt: Math.floor(Date.now() / 1000) + 300,
  });
  oauth.createRefreshGrant.mockResolvedValue({
    token: 'mcp_refresh_new',
    familyId: 'oauth_family_one',
  });
});

describe('Sola OAuth provider', () => {
  it('accepts only granted scopes and this MCP resource', async () => {
    const response = {
      status: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      type: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };
    oauth.createPendingAuthorization.mockResolvedValue({ requestId: 'oauth_req_one' });

    await provider().authorize(client, {
      scopes: ['demo:read'],
      codeChallenge: 'challenge',
      redirectUri: client.redirect_uris[0],
      resource: new URL('https://mcp.example.test/mcp'),
    }, response as never);

    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.send).toHaveBeenCalledWith('login oauth_req_one');
    expect(oauth.createPendingAuthorization).toHaveBeenCalledWith({
      clientId: client.client_id,
      redirectUri: client.redirect_uris[0],
      state: undefined,
      scopes: ['demo:read', 'demo:write'],
      codeChallenge: 'challenge',
      resource: 'https://mcp.example.test/mcp',
    });

    await expect(provider().authorize(client, {
      scopes: ['other:write'],
      codeChallenge: 'challenge',
      redirectUri: client.redirect_uris[0],
    }, response as never)).rejects.toBeInstanceOf(InvalidScopeError);

    await expect(provider().authorize(client, {
      scopes: ['demo:read'],
      codeChallenge: 'challenge',
      redirectUri: client.redirect_uris[0],
      resource: new URL('https://wrong.example.test/mcp'),
    }, response as never)).rejects.toBeInstanceOf(InvalidTargetError);
  });

  it('binds a single-use code to its client, redirect, resource, and PKCE challenge', async () => {
    oauth.getAuthorizationCodeDetails.mockResolvedValue({
      challenge: 'saved-challenge',
      clientId: client.client_id,
      redirectUri: client.redirect_uris[0],
      resource: 'https://mcp.example.test/mcp',
    });
    oauth.consumeAuthorizationCode
      .mockResolvedValueOnce({
        ...credentials,
        clientId: client.client_id,
        redirectUri: client.redirect_uris[0],
        scopes: ['demo:read'],
        resource: 'https://mcp.example.test/mcp',
      })
      .mockResolvedValueOnce(null);

    await expect(provider().challengeForAuthorizationCode(
      { ...client, client_id: 'wrong-client' },
      'oauth_code_one',
    )).rejects.toBeInstanceOf(InvalidGrantError);

    expect(await provider().challengeForAuthorizationCode(client, 'oauth_code_one'))
      .toBe('saved-challenge');

    const tokens = await provider().exchangeAuthorizationCode(
      client,
      'oauth_code_one',
      undefined,
      client.redirect_uris[0],
      new URL('https://mcp.example.test/mcp'),
    );
    expect(tokens).toMatchObject({
      access_token: 'mcp_access',
      refresh_token: 'mcp_refresh_new',
      scope: 'demo:read',
    });
    await expect(provider().exchangeAuthorizationCode(
      client,
      'oauth_code_one',
      undefined,
      client.redirect_uris[0],
      new URL('https://mcp.example.test/mcp'),
    )).rejects.toBeInstanceOf(InvalidGrantError);
  });

  it('refreshes catalog credentials after the MCP access token expires', async () => {
    sessions.resolveSession.mockResolvedValueOnce(null);
    await expect(provider().verifyAccessToken('mcp_access_old')).rejects.toMatchObject({
      errorCode: 'invalid_token',
    });

    oauth.getRefreshGrantDetails.mockResolvedValue({
      clientId: client.client_id,
      scopes: ['demo:read'],
      resource: 'https://mcp.example.test/mcp',
      familyId: 'oauth_family_one',
      used: false,
    });
    oauth.claimRefreshGrant.mockResolvedValue({
      clientId: client.client_id,
      scopes: ['demo:read'],
      resource: 'https://mcp.example.test/mcp',
      catalogId: credentials.catalogId,
      subject: credentials.subject,
      refreshToken: credentials.refreshToken,
      tokenType: 'Bearer',
      whitelabel: 'demo',
      familyId: 'oauth_family_one',
    });
    refresh.mockResolvedValue({
      ...credentials,
      accessToken: 'catalog-access-refreshed',
      refreshToken: 'catalog-refresh-refreshed',
    });
    sessions.createSession.mockResolvedValue({
      accessToken: 'mcp_access_new',
      expiresAt: Math.floor(Date.now() / 1000) + 1200,
    });

    const tokens = await provider().exchangeRefreshToken(
      client,
      'mcp_refresh_old',
      ['demo:read'],
      new URL('https://mcp.example.test/mcp'),
    );

    expect(tokens).toMatchObject({
      access_token: 'mcp_access_new',
      refresh_token: 'mcp_refresh_new',
      token_type: 'Bearer',
    });
    expect(refresh).toHaveBeenCalledWith(credentials.refreshToken);
    expect(sessions.createSession).toHaveBeenCalledWith(expect.objectContaining({
      credentials: {
        demo: expect.objectContaining({ token: 'catalog-access-refreshed' }),
      },
    }));
  });

  it('rotates refresh tokens and rejects reuse, broader scope, and a wrong resource', async () => {
    oauth.getRefreshGrantDetails.mockResolvedValue({
      clientId: client.client_id,
      scopes: ['demo:read'],
      resource: 'https://mcp.example.test/mcp',
      familyId: 'oauth_family_one',
      used: false,
    });
    oauth.claimRefreshGrant
      .mockResolvedValueOnce({
        clientId: client.client_id,
        scopes: ['demo:read'],
        resource: 'https://mcp.example.test/mcp',
        subject: credentials.subject,
        catalogId: credentials.catalogId,
        refreshToken: credentials.refreshToken,
        tokenType: 'Bearer',
        whitelabel: 'demo',
        familyId: 'oauth_family_one',
      })
      .mockResolvedValueOnce(null);

    const tokens = await provider().exchangeRefreshToken(
      client,
      'mcp_refresh_old',
      ['demo:read'],
      new URL('https://mcp.example.test/mcp'),
    );
    expect(tokens.refresh_token).toBe('mcp_refresh_new');

    await expect(provider().exchangeRefreshToken(
      client,
      'mcp_refresh_old',
      ['demo:read'],
      new URL('https://mcp.example.test/mcp'),
    )).rejects.toBeInstanceOf(InvalidGrantError);

    oauth.claimRefreshGrant.mockResolvedValue({
      clientId: client.client_id,
      scopes: ['demo:read'],
      resource: 'https://mcp.example.test/mcp',
      subject: credentials.subject,
      catalogId: credentials.catalogId,
      refreshToken: credentials.refreshToken,
      tokenType: 'Bearer',
      whitelabel: 'demo',
      familyId: 'oauth_family_one',
    });
    await expect(provider().exchangeRefreshToken(
      client,
      'mcp_refresh_another',
      ['demo:write'],
      new URL('https://mcp.example.test/mcp'),
    )).rejects.toBeInstanceOf(InvalidScopeError);
    await expect(provider().exchangeRefreshToken(
      client,
      'mcp_refresh_another',
      ['demo:read'],
      new URL('https://wrong.example.test/mcp'),
    )).rejects.toBeInstanceOf(InvalidGrantError);
  });

  it('revokes the active token family when a rotated refresh token is replayed', async () => {
    oauth.getRefreshGrantDetails.mockResolvedValue({
      clientId: client.client_id,
      scopes: ['demo:read'],
      resource: 'https://mcp.example.test/mcp',
      familyId: 'oauth_family_one',
      used: true,
    });

    await expect(provider().exchangeRefreshToken(
      client,
      'mcp_refresh_used',
      ['demo:read'],
      new URL('https://mcp.example.test/mcp'),
    )).rejects.toBeInstanceOf(InvalidGrantError);

    expect(oauth.revokeRefreshFamily).toHaveBeenCalledWith('oauth_family_one');
    expect(refresh).not.toHaveBeenCalled();
  });

  it('revokes only access tokens owned by the requesting client', async () => {
    sessions.resolveSession.mockResolvedValue({ clientId: client.client_id });

    await provider().revokeToken(client, { token: 'mcp_access' });
    await provider().revokeToken(client, { token: 'mcp_refresh_value' });

    expect(sessions.revokeSession).toHaveBeenCalledWith('mcp_access');
    expect(oauth.revokeRefreshGrant).toHaveBeenCalledWith(
      'mcp_refresh_value',
      client.client_id,
    );
  });
});
