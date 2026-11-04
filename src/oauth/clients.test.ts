import { describe, expect, it, vi } from 'vitest';
import { InvalidClientMetadataError } from '@modelcontextprotocol/sdk/server/auth/errors.js';
import { assertRedirectUris, createSolaClientsStore, validRedirectUri } from './clients';

describe('OAuth redirect URLs', () => {
  it('allows HTTPS and loopback callbacks but rejects insecure remote callbacks', () => {
    expect(validRedirectUri('https://client.example.test/callback')).toBe(true);
    expect(validRedirectUri('http://127.0.0.1:49152/callback')).toBe(true);
    expect(validRedirectUri('http://client.example.test/callback')).toBe(false);
    expect(() => assertRedirectUris(['http://client.example.test/callback']))
      .toThrow(InvalidClientMetadataError);
  });

  it('persists a registered public client', async () => {
    const saveClient = vi.fn().mockResolvedValue(undefined);
    const store = createSolaClientsStore({
      getClient: vi.fn(),
      saveClient,
    });
    const registered = await store.registerClient({
      redirect_uris: ['https://client.example.test/callback'],
      token_endpoint_auth_method: 'none',
    });
    expect(registered).toMatchObject({
      token_endpoint_auth_method: 'none',
      grant_types: ['authorization_code', 'refresh_token'],
    });
    expect(saveClient).toHaveBeenCalledWith(expect.objectContaining({
      client_id: expect.stringMatching(/^mcp_client_/),
      redirect_uris: ['https://client.example.test/callback'],
    }));
  });
});
