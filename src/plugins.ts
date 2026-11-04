import type { Router } from 'express';
import type { ProductRegistry, RegistryAuth } from './types';

let installed: ProductRegistry[] = [];
let identity = {
  serviceName: 'sola',
  resourceName: 'Sola',
};

export const useRegistries = (registries: ProductRegistry[]): void => {
  installed = registries;
};

export const useHostIdentity = (next: { serviceName: string; resourceName: string }): void => {
  identity = next;
};

export const hostIdentity = () => identity;

export const installedRegistries = (): ProductRegistry[] => installed;

export const findCatalog = (serverId: string) =>
  installed.find((registry) => registry.catalog.id === serverId)?.catalog;

export const findCatalogWrite = (operation: string) =>
  installed.find((registry) => registry.catalog.ownsWrite?.(operation))?.catalog;

export const findRegistryWrite = (operation: string) =>
  installed.find((registry) => registry.catalog.ownsWrite?.(operation));

export const logins = (): RegistryAuth[] =>
  installed.flatMap((registry) => (registry.auth ? [registry.auth] : []));

export const findAuth = (catalogId: string): RegistryAuth | undefined =>
  logins().find((auth) => auth.catalogId === catalogId);

export const hostLogin = (): RegistryAuth | undefined =>
  logins().find((auth) => auth.credentialsFromToken);

export const advertisedScopes = (): string[] => {
  const scopes = new Set<string>();
  for (const auth of logins()) {
    for (const scope of auth.scopes()) scopes.add(scope);
  }
  return [...scopes];
};

export const scopeAllowed = (scope: string): boolean =>
  logins().some((auth) => auth.allowsScope(scope));

export const authForScopes = (scopes: readonly string[]): RegistryAuth | undefined => {
  const matches = logins().filter((auth) => scopes.every((scope) => auth.allowsScope(scope)));
  return matches.length === 1 ? matches[0] : undefined;
};

export const rejectedScopeMessage = (scopes: readonly string[]): string => {
  const ranked = logins()
    .map((auth) => ({
      auth,
      hits: scopes.filter((scope) => auth.allowsScope(scope)).length,
    }))
    .sort((left, right) => right.hits - left.hits);
  return ranked[0]?.auth.rejectedScopeMessage() ?? 'Requested scope is not available';
};

export const registryRouters = (): Router[] =>
  installed.flatMap((registry) => [
    ...(registry.routes ? [registry.routes] : []),
    ...(registry.auth ? [registry.auth.routes] : []),
  ]);

export const writeScopeNames = (): readonly string[] =>
  installed.flatMap((registry) => registry.writeScopes ?? []);

export const cancelledWriteMessage = (operation: string): string =>
  findRegistryWrite(operation)?.cancelledWriteMessage ?? 'No write was made.';
