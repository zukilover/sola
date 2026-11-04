import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import type { McpSession } from '../types';
import { bindCatalogTools, compileServer } from './compile';

const session: McpSession = {
  sessionHash: 'session-hash',
  subject: 'user-id',
  credentials: {},
  scopes: ['demo:read'],
  expiresAt: Math.floor(Date.now() / 1000) + 60,
};

describe('generic catalog compiler', () => {
  it('invokes a declared HTTP tool through the injected client', async () => {
    const request = vi.fn().mockResolvedValue({ ok: true });
    const tools = [{
      name: 'ping',
      title: 'Ping',
      description: 'Ping the demo backend.',
      enabled: true,
      scopes: ['demo:read'],
      input: z.object({ id: z.string() }).strict(),
      schema: { type: 'object' },
      request: { path: '/v1/ping/{id}.json', query: ['id'] },
      normalize: (payload: unknown) => payload as Record<string, unknown>,
    }];
    const catalog = bindCatalogTools(tools, () => ({ request }));

    const result = await catalog.invoke(session, 'ping', { id: '12' });

    expect(request).toHaveBeenCalledWith('/v1/ping/12.json', {
      method: undefined,
      query: { id: '12' },
      body: undefined,
    });
    expect(result.structuredContent).toEqual({ ok: true });
  });

  it('compiles allowlist entries without a product name', () => {
    const tools = [{
      name: 'ping',
      title: 'Ping',
      description: 'Ping the demo backend.',
      enabled: true,
      scopes: ['demo:read'],
      input: z.object({}).strict(),
      schema: { type: 'object' },
      request: { path: '/v1/ping.json' },
      normalize: () => ({ ok: true }),
    }];

    expect(compileServer({
      id: 'demo',
      title: 'Demo',
      description: 'Demo catalog.',
      owner: 'host',
      kind: 'catalog',
      enabled: true,
      access: { scopes: ['demo:read'], clients: ['*'] },
    }, tools).tools).toEqual([
      expect.objectContaining({ name: 'ping', scopes: ['demo:read'] }),
    ]);
  });
});
