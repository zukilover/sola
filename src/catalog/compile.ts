import type { z } from 'zod';
import { failure, success, type StructuredResult } from '../mcpResult';
import type { RegistryServer, RegistryTool } from '../registry/schema';
import type { McpSession, WritePrompt, WriteRuntime } from '../types';
import { WRITE_META } from './writeMeta';

export type FieldMapper = (value: unknown) => string | number | boolean;

export type CatalogHttpRequest = {
  method?: 'GET' | 'POST' | 'PUT';
  path: string;
  query?: readonly string[];
  body?: readonly string[] | Record<string, string>;
  maps?: Partial<Record<string, FieldMapper>>;
};

export type CatalogHttpClient = {
  request: (
    path: string,
    options?: {
      method?: 'GET' | 'POST' | 'PUT';
      query?: Record<string, string | number | boolean>;
      body?: Record<string, unknown>;
    },
  ) => Promise<unknown>;
};

export type WriteConfig = {
  confirmTitle: string;
  labels: Record<string, string>;
  hide?: readonly string[];
  display?: Record<string, (value: string | number | boolean) => string>;
  acceptance?: WritePrompt['acceptance'] | (() => WritePrompt['acceptance']);
};

export type ToolContext<TClient extends CatalogHttpClient = CatalogHttpClient> = {
  session: McpSession;
  client: TClient;
  input: Record<string, unknown>;
  payload: Record<string, string | number | boolean>;
};

export type CatalogTool<TClient extends CatalogHttpClient = CatalogHttpClient> = {
  name: string;
  title: string;
  description: string;
  enabled: boolean;
  scopes: readonly string[];
  input: z.ZodType;
  schema: Record<string, unknown>;
  write?: WriteConfig;
  request?: CatalogHttpRequest;
  normalize?: (payload: unknown, ctx: ToolContext<TClient>) => StructuredResult;
  execute?: (ctx: ToolContext<TClient>) => Promise<StructuredResult>;
};

const isWriteScope = (scope: string): boolean => scope.endsWith(':write');

export const assertCatalogTools = <TClient extends CatalogHttpClient>(
  tools: readonly CatalogTool<TClient>[],
): void => {
  const names = new Set<string>();
  for (const tool of tools) {
    if (names.has(tool.name)) {
      throw new Error(`Duplicate catalog tool: ${tool.name}`);
    }
    names.add(tool.name);
    if (tool.scopes.some(isWriteScope) && !tool.write) {
      throw new Error(`Catalog tool ${tool.name} is a write without confirm metadata`);
    }
    if (!tool.execute && (!tool.request || !tool.normalize)) {
      throw new Error(`Catalog tool ${tool.name} needs request and normalize, or execute`);
    }
  }
};

export const compileServer = <TClient extends CatalogHttpClient>(
  info: Omit<RegistryServer, 'tools'>,
  tools: readonly CatalogTool<TClient>[],
): RegistryServer => {
  assertCatalogTools(tools);
  return {
    ...info,
    tools: tools.map((tool): RegistryTool => ({
      name: tool.name,
      title: tool.title,
      description: tool.description,
      enabled: tool.enabled,
      scopes: [...tool.scopes],
    })),
  };
};

export const getToolSchema = <TClient extends CatalogHttpClient>(
  tools: readonly CatalogTool<TClient>[],
  toolName: string,
) => tools.find((tool) => tool.name === toolName)?.schema;

export const ownsWrite = <TClient extends CatalogHttpClient>(
  tools: readonly CatalogTool<TClient>[],
  operation: string,
): boolean => tools.some((tool) => tool.name === operation && tool.write);

export const describeWrite = <TClient extends CatalogHttpClient>(
  tools: readonly CatalogTool<TClient>[],
  operation: string,
  payload: Record<string, string | number | boolean>,
): WritePrompt => {
  const tool = tools.find((item) => item.name === operation);
  const write = tool?.write;
  const hide = new Set(write?.hide ?? []);
  const prompt: WritePrompt = {
    title: write?.confirmTitle || 'Confirm write',
    rows: Object.entries(payload)
      .filter(([key]) => !hide.has(key))
      .map(([key, value]) => ({
        label: write?.labels[key] || key,
        value: write?.display?.[key]?.(value) ?? String(value),
      })),
  };
  const acceptance = typeof write?.acceptance === 'function'
    ? write.acceptance()
    : write?.acceptance;
  if (acceptance) prompt.acceptance = acceptance;
  return prompt;
};

const interpolate = (path: string, values: Record<string, unknown>): string =>
  path.replace(/\{([a-z0-9_]+)\}/gi, (_, key: string) => {
    const value = values[key];
    if (value === undefined || value === null || value === '') {
      throw new Error(`Missing path value: ${key}`);
    }
    return encodeURIComponent(String(value));
  });

const readField = (
  source: Record<string, unknown>,
  field: string,
  maps?: Partial<Record<string, FieldMapper>>,
): string | number | boolean | undefined => {
  const value = source[field];
  if (value === undefined) return undefined;
  const map = maps?.[field];
  if (map) return map(value);
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  return undefined;
};

const pickFields = (
  source: Record<string, unknown>,
  fields: readonly string[] | Record<string, string>,
  maps?: Partial<Record<string, FieldMapper>>,
): Record<string, string | number | boolean> => {
  const entries = Array.isArray(fields)
    ? fields.map((field) => [field, field] as const)
    : Object.entries(fields);
  const picked: Record<string, string | number | boolean> = {};
  for (const [dest, sourceField] of entries) {
    const value = readField(source, sourceField, maps);
    if (value !== undefined) picked[dest] = value;
  }
  return picked;
};

const writePayload = (input: Record<string, unknown>): Record<string, string | number | boolean> => {
  const payload: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(input)) {
    if (WRITE_META.has(key) || value === undefined) continue;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      payload[key] = value;
    }
  }
  return payload;
};

const runDeclared = async <TClient extends CatalogHttpClient>(
  session: McpSession,
  tool: CatalogTool<TClient>,
  input: Record<string, unknown>,
  payload: Record<string, string | number | boolean>,
  createClient: (session: McpSession) => TClient,
): Promise<StructuredResult> => {
  const client = createClient(session);
  const ctx: ToolContext<TClient> = { session, client, input, payload };
  if (tool.execute) return tool.execute(ctx);
  if (!tool.request || !tool.normalize) {
    throw new Error(`Catalog tool is not implemented: ${tool.name}`);
  }
  const values = { ...input, ...payload };
  const raw = await client.request(interpolate(tool.request.path, values), {
    method: tool.request.method,
    query: tool.request.query
      ? pickFields(values, tool.request.query, tool.request.maps)
      : undefined,
    body: tool.request.body
      ? pickFields(values, tool.request.body, tool.request.maps)
      : undefined,
  });
  return tool.normalize(raw, ctx);
};

const requireWriteRuntime = (writes: WriteRuntime | undefined): WriteRuntime => {
  if (!writes) throw new Error('Write runtime is required for write tools');
  return writes;
};

const runWrite = async ({
  session,
  operation,
  payload,
  confirmationToken,
  idempotencyKey,
  execute,
  writes,
}: {
  session: McpSession;
  operation: string;
  payload: Record<string, string | number | boolean>;
  confirmationToken?: string;
  idempotencyKey: string;
  execute: () => Promise<StructuredResult>;
  writes: WriteRuntime;
}) => {
  const existing = await writes.getIdempotentResult(session.sessionHash, operation, idempotencyKey);
  if (existing && typeof existing === 'object') {
    return success(existing as StructuredResult);
  }

  if (writes.confirmationEnabled) {
    if (confirmationToken) {
      await writes.consumeConfirmation({
        token: confirmationToken,
        sessionHash: session.sessionHash,
        operation,
        payload,
      });
    } else if (!await writes.consumeMatchingConfirmation({
      sessionHash: session.sessionHash,
      operation,
      payload,
    })) {
      const pending = await writes.createWriteConfirmRequest({
        sessionHash: session.sessionHash,
        operation,
        payload,
        idempotencyKey,
      });
      return success({
        status: 'needs_confirmation',
        confirm_url: `${writes.publicBaseUrl}/writes/confirm/${pending.requestId}`,
        expires_at: pending.expiresAt,
        message: 'Open confirm_url and confirm the exact payload. The write runs on that page. Then retry this same tool with the same idempotency_key to read the result.',
      });
    }
  }
  await writes.reserveIdempotencyKey(session.sessionHash, operation, idempotencyKey);

  const result = await execute();
  await writes.completeIdempotentOperation(session.sessionHash, operation, idempotencyKey, result);
  return success(result);
};

export const invokeTool = async <TClient extends CatalogHttpClient>(
  tools: readonly CatalogTool<TClient>[],
  session: McpSession,
  toolName: string,
  raw: unknown,
  createClient: (session: McpSession) => TClient,
  writes?: WriteRuntime,
) => {
  const tool = tools.find((item) => item.name === toolName);
  if (!tool) {
    return failure(new Error(`Catalog tool is not implemented: ${toolName}`));
  }
  try {
    const input = tool.input.parse(raw ?? {}) as Record<string, unknown>;
    const payload = writePayload(input);
    if (!tool.write) {
      return success(await runDeclared(session, tool, input, payload, createClient));
    }
    const confirmationToken = typeof input.confirmation_token === 'string'
      ? input.confirmation_token
      : undefined;
    return await runWrite({
      session,
      operation: tool.name,
      payload,
      confirmationToken,
      idempotencyKey: String(input.idempotency_key),
      execute: () => runDeclared(session, tool, input, payload, createClient),
      writes: requireWriteRuntime(writes),
    });
  } catch (error) {
    return failure(error);
  }
};

export const confirmWrite = async <TClient extends CatalogHttpClient>(
  tools: readonly CatalogTool<TClient>[],
  session: McpSession,
  operation: string,
  payload: Record<string, string | number | boolean>,
  idempotencyKey: string,
  createClient: (session: McpSession) => TClient,
  writes: WriteRuntime,
): Promise<StructuredResult> => {
  const tool = tools.find((item) => item.name === operation && item.write);
  if (!tool) {
    throw new Error(`Unsupported write: ${operation}`);
  }
  const existing = await writes.getIdempotentResult(session.sessionHash, operation, idempotencyKey);
  if (existing && typeof existing === 'object') {
    return existing as StructuredResult;
  }
  if (!await writes.consumeMatchingConfirmation({
    sessionHash: session.sessionHash,
    operation,
    payload,
  })) {
    throw new Error('Write confirmation is missing, expired, reused, or does not match the payload');
  }
  const result = await runDeclared(session, tool, payload, payload, createClient);
  await writes.storeIdempotentResult(session.sessionHash, operation, idempotencyKey, result);
  return result;
};

export const bindCatalogTools = <TClient extends CatalogHttpClient>(
  tools: readonly CatalogTool<TClient>[],
  createClient: (session: McpSession) => TClient,
  writes?: WriteRuntime,
) => {
  assertCatalogTools(tools);
  return {
    getToolSchema: (toolName: string) => getToolSchema(tools, toolName),
    invoke: (session: McpSession, toolName: string, raw: unknown) =>
      invokeTool(tools, session, toolName, raw, createClient, writes),
    ownsWrite: (operation: string) => ownsWrite(tools, operation),
    describeWrite: (
      operation: string,
      payload: Record<string, string | number | boolean>,
    ) => describeWrite(tools, operation, payload),
    runConfirmedWrite: (
      session: McpSession,
      operation: string,
      payload: Record<string, string | number | boolean>,
      idempotencyKey: string,
    ) => confirmWrite(
      tools,
      session,
      operation,
      payload,
      idempotencyKey,
      createClient,
      requireWriteRuntime(writes),
    ),
  };
};
