# Security

Sola’s threat model is: MCP clients are untrusted, backend credentials are
secret, and the catalog is the allowlist.

## Reporting

If you believe you have found a vulnerability in Sola, email the maintainers
privately. Do not file a public issue until a fix is released.

## Rules that do not wait for a CVE

- Backend access tokens MUST NOT appear in MCP tokens, prompts, logs, or
  tool arguments.
- Write tools MUST NOT run without an idempotency key. When confirmation is
  enabled, they MUST NOT run without a matching confirmation receipt.
- Discovery tools MUST NOT invoke nested discovery or `invoke_tool`.
