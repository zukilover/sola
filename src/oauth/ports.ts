import type { CatalogCredential, CatalogSignIn, McpSession } from '../types';

export type SolaOAuthClient = {
  client_id: string;
  client_id_issued_at?: number;
  redirect_uris: string[];
  client_secret?: string;
  client_secret_expires_at?: number;
  token_endpoint_auth_method?: string;
  grant_types?: string[];
  response_types?: string[];
  client_name?: string;
  scope?: string;
};

export type SolaPendingAuthorizationInput = {
  clientId: string;
  redirectUri: string;
  state?: string;
  scopes: string[];
  codeChallenge: string;
  resource?: string;
};

export type SolaAuthorizationCodeDetails = {
  challenge: string;
  clientId: string;
  redirectUri: string;
  resource?: string;
};

export type SolaConsumedAuthorization = CatalogSignIn & {
  clientId: string;
  redirectUri: string;
  scopes: string[];
  resource?: string;
};

export type SolaCreateRefreshGrantInput = {
  clientId: string;
  scopes: string[];
  resource?: string;
  credentials: CatalogSignIn;
  familyId?: string;
};

export type SolaRefreshGrantDetails = {
  clientId: string;
  scopes: string[];
  resource?: string;
  familyId: string;
  used: boolean;
};

export type SolaClaimedRefreshGrant = {
  catalogId: string;
  subject: string;
  refreshToken: string;
  tokenType: string;
  whitelabel: string;
  clientId: string;
  scopes: string[];
  resource?: string;
  familyId: string;
};

export type SolaOAuthRuntime = {
  getClient: (clientId: string) => Promise<SolaOAuthClient | undefined>;
  saveClient: (client: SolaOAuthClient) => Promise<void>;
  createPendingAuthorization: (
    input: SolaPendingAuthorizationInput,
  ) => Promise<{ requestId: string }>;
  getAuthorizationCodeDetails: (
    code: string,
  ) => Promise<SolaAuthorizationCodeDetails | null>;
  consumeAuthorizationCode: (
    code: string,
    expected: { clientId: string; redirectUri: string },
  ) => Promise<SolaConsumedAuthorization | null>;
  createRefreshGrant: (
    input: SolaCreateRefreshGrantInput,
  ) => Promise<{ token: string; familyId: string }>;
  getRefreshGrantDetails: (token: string) => Promise<SolaRefreshGrantDetails | null>;
  claimRefreshGrant: (
    token: string,
    clientId: string,
  ) => Promise<SolaClaimedRefreshGrant | null>;
  releaseRefreshGrant: (token: string, clientId: string) => Promise<void>;
  linkOAuthTokenPair: (
    accessToken: string,
    refreshToken: string,
    familyId: string,
  ) => Promise<void>;
  revokeRefreshGrant: (token: string, clientId: string) => Promise<void>;
  revokeRefreshFamily: (familyId: string) => Promise<void>;
};

export type SolaSessionRuntime = {
  createSession: (input: {
    subject: string;
    credentials: Record<string, CatalogCredential>;
    scopes: string[];
    clientId?: string;
    resource?: string;
    expiresInSeconds?: number;
  }) => Promise<{ accessToken: string; expiresAt: number }>;
  resolveSession: (token: string) => Promise<McpSession | null>;
  revokeSession: (token: string) => Promise<void>;
};
