# 3. Discovery

This document is normative for Sola 0.1.

## 3.1 MCP surface

The MCP server MUST register exactly these tools:

| Tool | Input | Result |
| --- | --- | --- |
| `discover_servers` | `query` | Up to 10 servers |
| `discover_tools` | `server_id`, optional `query` | Up to 20 tools |
| `get_tool_schema` | `server_id`, `tool_name` | One input JSON Schema |
| `invoke_tool` | `server_id`, `tool_name`, `arguments` | Tool result |

The server MUST NOT list product tools in MCP `tools/list`. Clients find
product tools only through discovery.

## 3.2 Query matching

`discover_servers` and `discover_tools` tokenize `query` on non-alphanumeric
characters. Tokens shorter than 3 characters MUST be ignored. A haystack
matches if **any** remaining token is a substring of the haystack
(case-insensitive). An empty needle list MUST not match.

Server haystack: id, title, description, kind, owner, plus enabled tools the
session may use. Tool haystack: name, title, description.

This is a filter, not a ranker. The client model chooses among the hits.

## 3.3 Visibility

A server is visible only when it is enabled and the session has at least one
of its access scopes. A tool is invocable only when the server and tool are
enabled, every tool scope is on the session, and write scopes are allowed by
the host write flag.

## 3.4 Nesting

`invoke_tool` MUST reject `server_id` or `tool_name` equal to a discovery tool
name. `get_tool_schema` MUST reject discovery tool names.
