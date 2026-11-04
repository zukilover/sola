import { z } from 'zod';

export const registryScopeSchema = z.string().regex(/^[a-z][a-z0-9_-]*:[a-z][a-z0-9_-]*$/);

export const registryClientSchema = z.enum(['*', 'host', 'oauth']);

export const registryToolSchema = z.object({
  name: z.string().trim().min(1).max(100),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(1_000),
  enabled: z.boolean().default(false),
  scopes: z.array(registryScopeSchema).min(1),
}).strict();

export const registryServerSchema = z.object({
  id: z.string().trim().min(1).max(100),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(1_000),
  owner: z.string().trim().min(1).max(200),
  kind: z.enum(['catalog', 'mcp-server']),
  enabled: z.boolean().default(false),
  access: z.object({
    scopes: z.array(registryScopeSchema).min(1),
    clients: z.array(registryClientSchema).min(1),
  }).strict(),
  tools: z.array(registryToolSchema).max(50),
}).strict();

export const registrySchema = z.object({
  version: z.string().regex(/^[0-9]+$/),
  servers: z.array(registryServerSchema).min(1),
}).strict().superRefine((registry, ctx) => {
  const serverIds = new Set<string>();
  registry.servers.forEach((server, serverIndex) => {
    if (serverIds.has(server.id)) {
      ctx.addIssue({
        code: 'custom',
        message: `Duplicate server id: ${server.id}`,
        path: ['servers', serverIndex, 'id'],
      });
    }
    serverIds.add(server.id);

    const toolNames = new Set<string>();
    server.tools.forEach((tool, toolIndex) => {
      if (toolNames.has(tool.name)) {
        ctx.addIssue({
          code: 'custom',
          message: `Duplicate tool name: ${tool.name}`,
          path: ['servers', serverIndex, 'tools', toolIndex, 'name'],
        });
      }
      toolNames.add(tool.name);
      tool.scopes.forEach((scope, scopeIndex) => {
        if (!server.access.scopes.includes(scope)) {
          ctx.addIssue({
            code: 'custom',
            message: `Tool ${tool.name} uses a scope the server does not allow`,
            path: ['servers', serverIndex, 'tools', toolIndex, 'scopes', scopeIndex],
          });
        }
      });
    });
  });
});

export type McpRegistry = z.infer<typeof registrySchema>;
export type RegistryServer = z.infer<typeof registryServerSchema>;
export type RegistryTool = z.infer<typeof registryToolSchema>;
