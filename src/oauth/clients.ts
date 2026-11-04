import { randomBytes } from 'node:crypto';
import { InvalidClientMetadataError } from '@modelcontextprotocol/sdk/server/auth/errors.js';
import type { OAuthServerProvider } from '@modelcontextprotocol/sdk/server/auth/provider.js';
import type { OAuthClientInformationFull } from '@modelcontextprotocol/sdk/shared/auth.js';
import type { SolaOAuthClient, SolaOAuthRuntime } from './ports';

const isLoopbackHostname = (hostname: string): boolean =>
  hostname === 'localhost'
  || hostname === '127.0.0.1'
  || hostname === '::1'
  || hostname === '[::1]';

export const validRedirectUri = (value: string): boolean => {
  const url = new URL(value);
  if (url.username || url.password || url.hash) return false;
  return url.protocol === 'https:' || (url.protocol === 'http:' && isLoopbackHostname(url.hostname));
};

export const assertRedirectUris = (uris?: readonly string[]): void => {
  if (!uris?.length || !uris.every(validRedirectUri)) {
    throw new InvalidClientMetadataError(
      'Redirect URLs must use HTTPS or a local loopback address',
    );
  }
};

export const createSolaClientsStore = (
  oauth: Pick<SolaOAuthRuntime, 'getClient' | 'saveClient'>,
): OAuthServerProvider['clientsStore'] => ({
  getClient: async (clientId) => {
    const client = await oauth.getClient(clientId);
    return client as OAuthClientInformationFull | undefined;
  },
  registerClient: async (client) => {
    assertRedirectUris(client.redirect_uris);
    const registered: SolaOAuthClient = {
      ...client,
      client_id: `mcp_client_${randomBytes(32).toString('base64url')}`,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      client_secret: undefined,
      client_secret_expires_at: undefined,
      token_endpoint_auth_method: 'none',
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
    };
    await oauth.saveClient(registered);
    return registered as OAuthClientInformationFull;
  },
});
