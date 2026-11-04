# Sola specification

These documents are normative for Sola 0.1. Keywords follow
[RFC 2119](https://datatracker.ietf.org/doc/html/rfc2119).

| Document | Topic |
| --- | --- |
| [01-overview.md](./01-overview.md) | Roles, MCP surface, non-goals, versioning |
| [02-catalog.md](./02-catalog.md) | Catalog tools, codecs, HTTP steps, `execute` |
| [03-discovery.md](./03-discovery.md) | Four public tools and query matching |
| [04-writes.md](./04-writes.md) | Confirmation, idempotency, write metadata |
| [05-security.md](./05-security.md) | Token split, OAuth, allowlisting |
| [06-adapters.md](./06-adapters.md) | Drafting a catalog from another spec |

The TypeScript runtime in `src/` implements this specification. If the two
disagree, fix them in the same change; the spec is the contract.
