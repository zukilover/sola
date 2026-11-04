# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-11-04

### Added

- `attachSola` HTTP host: Streamable HTTP, OAuth 2.1 + PKCE, bearer auth.
  Hosts inject session and grant storage.
- Catalog IDL as TypeScript (`CatalogTool`), compiled with `compileServer`.
- Four-tool MCP surface: `discover_servers`, `discover_tools`,
  `get_tool_schema`, `invoke_tool`.
- Write confirmation and idempotency through an injected `WriteRuntime`.
- Registry plugin host (`useRegistries`) so product backends stay outside
  this package.
- RFC 2119 specification under `spec/`.

### Changed

- npm package name is `sola-mcp-gateway`.
- Registry client id `luna-host` is now `host`.
- `useHostIdentity` / `hostIdentity` replace `useGatewayIdentity` /
  `gatewayIdentity`.
