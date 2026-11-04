# 1. Overview

This document is normative for Sola 0.1.

The key words MUST, MUST NOT, SHOULD, MAY are to be interpreted as described
in [RFC 2119](https://datatracker.ietf.org/doc/html/rfc2119).

## 1.1 Purpose

Sola is a catalog runtime for [MCP](https://modelcontextprotocol.io/). A
**host** runs Sola and installs **registries**. A registry is an
implementation: it names a backend, its login, and its approved tools.

MCP clients connect to one Streamable HTTP resource, typically `/mcp`. That
resource MUST expose only the discovery tools defined in
[03-discovery.md](./03-discovery.md). Product operations MUST run only through
`invoke_tool` after the registry allowlist permits them.

## 1.2 Roles

| Role | Responsibility |
| --- | --- |
| MCP client | Claude, Cursor, Codex, or a host chat product. Holds opaque MCP tokens only. |
| Host | Process that stores sessions, OAuth grants, and confirmations. Installs registries. Owns AWS or other infra. |
| Sola runtime | Catalog compiler, discovery, write engine, MCP HTTP, and OAuth provider. |
| Registry | One backend’s catalog, HTTP client, and optional login. |

## 1.3 Non-goals

Sola MUST NOT:

- Register every operation from an OpenAPI, gRPC, GraphQL, SOAP, or similar
  specification as an MCP tool.
- Place backend access tokens in MCP access tokens, refresh tokens, or
  conversation history.
- Require a product name in the host.

Sola MAY provide adapters that **draft** a catalog from a specification.
A human MUST enable tools, name them, and mark writes. See
[06-adapters.md](./06-adapters.md).

## 1.4 Versioning

This specification uses a numeric string (`0`, `1`, …) for the **allowlist
document** a host serves. The TypeScript package uses semver. A host MAY pin
an allowlist version independently of the package version.
