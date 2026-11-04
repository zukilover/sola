import type { Response } from 'express';
import type {
  OAuthClientInformationFull,
  OAuthTokenRevocationRequest,
  OAuthTokens,
} from '@modelcontextprotocol/sdk/shared/auth.js';
import type {
  AuthorizationParams,
  OAuthServerProvider,
} from '@modelcontextprotocol/sdk/server/auth/provider.js';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import {
  InvalidGrantError,
  InvalidScopeError,
  InvalidTargetError,
  InvalidTokenError,
} from '@modelcontextprotocol/sdk/server/auth/errors.js';
import {
  advertisedScopes,
  authForScopes,
  findAuth,
  hostLogin,
  rejectedScopeMessage,
  scopeAllowed,
} from '../plugins';
import { CatalogSignInError, type CatalogSignIn } from '../types';
import { createSolaClientsStore } from './clients';
import type { SolaOAuthRuntime, SolaSessionRuntime } from './ports';

export type SolaOAuthProviderOptions = {
  publicBaseUrl: string;
  sessions: SolaSessionRuntime;
  oauth: SolaOAuthRuntime;
};

const sessionCredentials = (credentials: CatalogSignIn) => ({
  [credentials.catalogId]: {
    token: credentials.accessToken,
    tokenType: credentials.tokenType,
    whitelabel: credentials.whitelabel,
  },
});

export const sameResource = (left?: URL | string, right?: URL | string): boolean => {
  if (!left && !right) return true;
  if (!left || !right) return false;
  const normalize = (value: URL | string) => new URL(value.toString()).toString().replace(/\/$/, '');
  return normalize(left) === normalize(right);
};

const requireHostLogin = () => {
  const auth = hostLogin();
  if (!auth) throw new Error('This gateway has no login');
  return auth;
};

export const loginPage = (requestId: string) => requireHostLogin().loginPage(requestId);

export const loginPageHeaders = (nonce: string) => requireHostLogin().loginPageHeaders(nonce);

export const connectedPage = (openerOrigin: string) => requireHostLogin().connectedPage(openerOrigin);

export class SolaOAuthProvider implements OAuthServerProvider {
  readonly clientsStore;

  constructor(private readonly options: SolaOAuthProviderOptions) {
    this.clientsStore = createSolaClientsStore(options.oauth);
  }

  private allowedResource(resource?: URL): boolean {
    return Boolean(resource && sameResource(resource, `${this.options.publicBaseUrl}/mcp`));
  }

  async authorize(
    client: OAuthClientInformationFull,
    params: AuthorizationParams,
    res: Response,
  ): Promise<void> {
    const requestedScopes = params.scopes?.length ? params.scopes : advertisedScopes();
    if (requestedScopes.some((scope) => !scopeAllowed(scope))) {
      throw new InvalidScopeError(rejectedScopeMessage(requestedScopes));
    }
    const auth = authForScopes(requestedScopes);
    if (!auth) {
      throw new InvalidScopeError(rejectedScopeMessage(requestedScopes));
    }
    const scopes = [...auth.scopes()];
    if (!this.allowedResource(params.resource)) {
      throw new InvalidTargetError('The requested MCP resource is not available');
    }
    const pending = await this.options.oauth.createPendingAuthorization({
      clientId: client.client_id,
      redirectUri: params.redirectUri,
      state: params.state,
      scopes,
      codeChallenge: params.codeChallenge,
      resource: params.resource?.toString(),
    });
    const page = auth.loginPage(pending.requestId);
    res
      .status(200)
      .set(auth.loginPageHeaders(page.nonce))
      .type('html')
      .send(page.html);
  }

  async challengeForAuthorizationCode(
    client: OAuthClientInformationFull,
    authorizationCode: string,
  ): Promise<string> {
    const details = await this.options.oauth.getAuthorizationCodeDetails(authorizationCode);
    if (!details || details.clientId !== client.client_id) {
      throw new InvalidGrantError('Authorization code is invalid or expired');
    }
    return details.challenge;
  }

  async exchangeAuthorizationCode(
    client: OAuthClientInformationFull,
    authorizationCode: string,
    _codeVerifier?: string,
    redirectUri?: string,
    resource?: URL,
  ): Promise<OAuthTokens> {
    const { oauth, sessions } = this.options;
    const details = await oauth.getAuthorizationCodeDetails(authorizationCode);
    if (!details
      || details.clientId !== client.client_id
      || details.redirectUri !== redirectUri
      || !sameResource(details.resource, resource)) {
      throw new InvalidGrantError('Authorization code does not match this client request');
    }
    let grant;
    try {
      grant = await oauth.consumeAuthorizationCode(authorizationCode, {
        clientId: client.client_id,
        redirectUri: details.redirectUri,
      });
    } catch {
      throw new InvalidGrantError('Authorization code is invalid, expired, or already used');
    }
    if (!grant
      || grant.clientId !== client.client_id
      || grant.redirectUri !== redirectUri
      || !sameResource(grant.resource, resource)) {
      throw new InvalidGrantError('Authorization code does not match this client request');
    }
    const session = await sessions.createSession({
      subject: grant.subject,
      credentials: sessionCredentials(grant),
      scopes: grant.scopes.filter(scopeAllowed),
      clientId: client.client_id,
      resource: grant.resource,
      expiresInSeconds: grant.expiresInSeconds,
    });
    const refreshGrant = await oauth.createRefreshGrant({
      clientId: client.client_id,
      scopes: grant.scopes,
      resource: grant.resource,
      credentials: grant,
    });
    try {
      await oauth.linkOAuthTokenPair(
        session.accessToken,
        refreshGrant.token,
        refreshGrant.familyId,
      );
    } catch (error) {
      await Promise.allSettled([
        sessions.revokeSession(session.accessToken),
        oauth.revokeRefreshGrant(refreshGrant.token, client.client_id),
      ]);
      throw error;
    }
    return {
      access_token: session.accessToken,
      token_type: 'Bearer',
      expires_in: Math.max(1, session.expiresAt - Math.floor(Date.now() / 1000)),
      refresh_token: refreshGrant.token,
      scope: grant.scopes.join(' '),
    };
  }

  async exchangeRefreshToken(
    client: OAuthClientInformationFull,
    refreshToken: string,
    scopes?: string[],
    resource?: URL,
  ): Promise<OAuthTokens> {
    const { oauth, sessions } = this.options;
    const details = await oauth.getRefreshGrantDetails(refreshToken);
    if (!details
      || details.clientId !== client.client_id
      || !sameResource(details.resource, resource)) {
      throw new InvalidGrantError('Refresh token does not match this client request');
    }
    const requestedScopes = scopes?.length ? scopes : details.scopes;
    if (requestedScopes.some((scope) => !details.scopes.includes(scope) || !scopeAllowed(scope))) {
      throw new InvalidScopeError('Requested scope was not granted');
    }
    if (details.used) {
      await oauth.revokeRefreshFamily(details.familyId);
      throw new InvalidGrantError('Refresh token reuse was detected');
    }

    let grant;
    try {
      grant = await oauth.claimRefreshGrant(refreshToken, client.client_id);
    } catch {
      await oauth.revokeRefreshFamily(details.familyId);
      throw new InvalidGrantError('Refresh token is invalid, expired, or already used');
    }
    if (!grant) {
      await oauth.revokeRefreshFamily(details.familyId);
      throw new InvalidGrantError('Refresh token is invalid, expired, or already used');
    }
    const auth = findAuth(grant.catalogId);
    if (!auth) {
      await oauth.revokeRefreshFamily(grant.familyId);
      throw new InvalidGrantError('Refresh token is invalid, expired, or already used');
    }
    let credentials;
    try {
      credentials = await auth.refresh(grant.refreshToken);
    } catch (error) {
      const retryable = !(error instanceof CatalogSignInError)
        || error.status === undefined
        || error.status >= 500;
      if (retryable) {
        await Promise.allSettled([oauth.releaseRefreshGrant(refreshToken, client.client_id)]);
      }
      throw error;
    }
    if (credentials.subject !== grant.subject) {
      await oauth.revokeRefreshFamily(grant.familyId);
      throw new InvalidGrantError('Refresh returned a different user');
    }
    const session = await sessions.createSession({
      subject: credentials.subject,
      credentials: sessionCredentials(credentials),
      scopes: requestedScopes.filter(scopeAllowed),
      clientId: client.client_id,
      resource: grant.resource,
      expiresInSeconds: credentials.expiresInSeconds,
    });
    const nextRefreshGrant = await oauth.createRefreshGrant({
      clientId: client.client_id,
      scopes: requestedScopes,
      resource: grant.resource,
      credentials,
      familyId: grant.familyId,
    });
    try {
      await oauth.linkOAuthTokenPair(
        session.accessToken,
        nextRefreshGrant.token,
        nextRefreshGrant.familyId,
      );
    } catch (error) {
      await Promise.allSettled([
        sessions.revokeSession(session.accessToken),
        oauth.revokeRefreshGrant(nextRefreshGrant.token, client.client_id),
      ]);
      throw error;
    }
    return {
      access_token: session.accessToken,
      token_type: 'Bearer',
      expires_in: Math.max(1, session.expiresAt - Math.floor(Date.now() / 1000)),
      refresh_token: nextRefreshGrant.token,
      scope: requestedScopes.join(' '),
    };
  }

  async verifyAccessToken(token: string): Promise<AuthInfo> {
    const session = await this.options.sessions.resolveSession(token);
    if (!session) throw new InvalidTokenError('Access token is invalid or expired');
    return {
      token,
      clientId: session.clientId || 'host',
      scopes: session.scopes,
      expiresAt: session.expiresAt,
      resource: new URL(session.resource || `${this.options.publicBaseUrl}/mcp`),
      extra: { session },
    };
  }

  async revokeToken(
    client: OAuthClientInformationFull,
    request: OAuthTokenRevocationRequest,
  ): Promise<void> {
    if (request.token.startsWith('mcp_refresh_')) {
      await this.options.oauth.revokeRefreshGrant(request.token, client.client_id);
      return;
    }
    const session = await this.options.sessions.resolveSession(request.token);
    if (session?.clientId === client.client_id) {
      await this.options.sessions.revokeSession(request.token);
    }
  }
}
