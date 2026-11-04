# 6. Adapters

This document is normative for Sola 0.1.

## 6.1 Role

An adapter turns another interface description (OpenAPI, protobuf, GraphQL,
WSDL, SQL, …) into a **draft catalog**. It is not the MCP server.

## 6.2 Requirements

An adapter MUST:

- Emit `CatalogTool`-shaped entries (or the encoding of a later Sola version).
- Leave `enabled: false` unless a human allowlist says otherwise.
- Mark mutating operations as write tools with confirm metadata.
- Not copy the whole specification into tool descriptions.

An adapter SHOULD:

- Propose codecs when the spec uses enumerations or integer codes.
- Collapse multi-request workflows into one catalog tool with `execute` or,
  in a later version, declared steps.

An adapter MUST NOT:

- Register spec operations as top-level MCP tools on `/mcp`.
- Treat an unmodified specification as a finished catalog.

## 6.3 Host duty

The host remains responsible for login, session storage, and which draft
tools become enabled. Sola does not ship a required OpenAPI importer in 0.1.
