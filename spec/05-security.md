# 5. Security

This document is normative for Sola 0.1.

## 5.1 Token split

| Token | Who holds it |
| --- | --- |
| MCP access / refresh | MCP client |
| Backend (catalog) access / refresh | Host only, encrypted at rest |

MCP clients MUST receive opaque MCP tokens. They MUST NOT receive backend
access or refresh tokens.

## 5.2 Login

A registry MAY prove identity with Google, Apple, or another IdP. The
**backend** MUST still issue its own catalog credential. The host MUST NOT
put a backend password in an MCP token or in logs.

Password collection for a backend, if present at all, MUST be a host
development switch and MUST default off.

## 5.3 OAuth

Remote MCP clients MUST use OAuth 2.1 with PKCE. Sola owns the MCP OAuth
provider, discovery routes, bearer middleware, and Streamable HTTP transport.
The host MUST inject session storage and OAuth grant storage. The host MUST
NOT import the MCP SDK.

Refresh grants SHOULD last long enough for daily use. Access tokens SHOULD be
short lived. Refresh tokens MUST rotate on use. Reuse MUST revoke the token
family.

## 5.4 Allowlist

The catalog is the allowlist. A host MUST NOT invoke a backend method that is
not an enabled catalog tool for that session.
