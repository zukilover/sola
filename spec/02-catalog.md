# 2. Catalog

This document is normative for Sola 0.1.

## 2.1 Unit of work

A **catalog tool** is one allowlisted operation. It MUST have:

- `name`, `title`, `description`
- `enabled` (new tools SHOULD start disabled until the host turns them on)
- `scopes` (each MUST match `^[a-z][a-z0-9_-]*:[a-z][a-z0-9_-]*$`)
- `input` (runtime validator) and `schema` (JSON Schema for MCP clients)

It MUST provide either:

- `request` and `normalize`, or
- `execute`

A tool whose scope ends with `:write` MUST include write metadata
(`write`). See [04-writes.md](./04-writes.md).

## 2.2 Public names vs wire values

The JSON Schema is the **public** contract. The backend MAY use different
names or codes. A catalog MUST map public values to wire values in the
catalog, not in the model prompt.

A **codec** is a function `unknown → string | number | boolean` attached to a
request field (`maps`). Codecs MUST reject unknown values.

The TypeScript helper `mappedStringInput` MAY be used to parse aliases into
canonical public names before the codec runs.

## 2.3 HTTP request

`request` describes one backend call:

- `method` defaults to `GET`
- `path` MAY contain `{field}` placeholders
- `query` / `body` name the input fields to send
- `maps` names codecs for those fields

The host’s HTTP client, not Sola, enforces path allowlists for that backend.

## 2.4 Multi-step operations

When one HTTP call cannot express the write, the catalog MUST use `execute`.
Sola 0.1 does not yet declare a multi-step request list. An `execute`
implementation SHOULD:

1. Perform steps in order.
2. Avoid retrying a successful earlier step.
3. Return `partial_success` when a later step fails after a create.

A future minor version MAY replace `execute` with a declared step list. Hosts
MUST treat `execute` as valid in 0.1.

## 2.5 Normalize

`normalize` MUST return a structured object safe for the model. It MUST NOT
pass through raw authorization headers or unspecified backend fields that the
public schema did not already allow.

## 2.6 Encoding

Sola 0.1’s catalog encoding is TypeScript (`CatalogTool`). Hosts MUST compile
allowlist entries with `compileServer`. Other encodings are out of scope.
