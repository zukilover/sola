import type { Router } from 'express';
import type { RegistryServer } from './registry/schema';

export interface CatalogCredential {
  token: string;
  tokenType: string;
  whitelabel: string;
}

export interface McpSession {
  sessionHash: string;
  subject: string;
  credentials: Record<string, CatalogCredential>;
  scopes: string[];
  expiresAt: number;
  clientId?: string;
  resource?: string;
}

export interface ToolResult {
  content: Array<{ type: 'text'; text: string }>;
  structuredContent: Record<string, unknown>;
  isError?: boolean;
}

export interface WritePrompt {
  title: string;
  rows: Array<{ label: string; value: string }>;
  acceptance?: {
    field: string;
    lead: string;
    linkText: string;
    href: string | null;
    trail: string;
    unavailableMessage: string;
    requiredMessage: string;
  };
}

export interface CatalogSignIn {
  catalogId: string;
  subject: string;
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  whitelabel: string;
  expiresInSeconds?: number;
}

export class CatalogSignInError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'CatalogSignInError';
  }
}

export interface Catalog {
  id: string;
  server: RegistryServer;
  getToolSchema: (toolName: string) => Record<string, unknown> | undefined;
  invoke: (session: McpSession, toolName: string, raw: unknown) => Promise<ToolResult>;
  ownsWrite?: (operation: string) => boolean;
  describeWrite?: (
    operation: string,
    payload: Record<string, string | number | boolean>,
  ) => WritePrompt;
  runConfirmedWrite?: (
    session: McpSession,
    operation: string,
    payload: Record<string, string | number | boolean>,
    idempotencyKey: string,
  ) => Promise<Record<string, unknown>>;
}

export interface LoginPage {
  html: string;
  nonce: string;
}

export interface RegistryAuth {
  catalogId: string;
  scopes: () => readonly string[];
  allowsScope: (scope: string) => boolean;
  rejectedScopeMessage: () => string;
  loginPage: (requestId: string) => LoginPage;
  loginPageHeaders: (nonce: string) => Record<string, string>;
  connectedPage: (openerOrigin: string) => LoginPage;
  refresh: (refreshToken: string) => Promise<CatalogSignIn>;
  routes: Router;
  credentialsFromToken?: (
    token: string,
    tokenType: string,
    whitelabel: string,
  ) => Record<string, CatalogCredential>;
}

export interface LegacySessionBinding {
  catalogId: string;
  purpose: string;
  tokenField: string;
  tokenTypeField: string;
  whitelabelField: string;
}

export interface ProductRegistry {
  id: string;
  catalog: Catalog;
  auth?: RegistryAuth;
  routes?: Router;
  writeScopes?: readonly string[];
  cancelledWriteMessage?: string;
  legacySession?: LegacySessionBinding;
}

export type WritePayload = Record<string, string | number | boolean>;

export interface WriteRuntime {
  confirmationEnabled: boolean;
  publicBaseUrl: string;
  getIdempotentResult: (
    sessionHash: string,
    operation: string,
    idempotencyKey: string,
  ) => Promise<unknown>;
  consumeConfirmation: (input: {
    token: string;
    sessionHash: string;
    operation: string;
    payload: WritePayload;
  }) => Promise<unknown>;
  consumeMatchingConfirmation: (input: {
    sessionHash: string;
    operation: string;
    payload: WritePayload;
  }) => Promise<boolean>;
  createWriteConfirmRequest: (input: {
    sessionHash: string;
    operation: string;
    payload: WritePayload;
    idempotencyKey: string;
  }) => Promise<{ requestId: string; expiresAt: number }>;
  reserveIdempotencyKey: (
    sessionHash: string,
    operation: string,
    idempotencyKey: string,
  ) => Promise<unknown>;
  completeIdempotentOperation: (
    sessionHash: string,
    operation: string,
    idempotencyKey: string,
    result: Record<string, unknown>,
  ) => Promise<unknown>;
  storeIdempotentResult: (
    sessionHash: string,
    operation: string,
    idempotencyKey: string,
    result: Record<string, unknown>,
  ) => Promise<unknown>;
}
