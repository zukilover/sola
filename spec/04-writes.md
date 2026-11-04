# 4. Writes

This document is normative for Sola 0.1.

## 4.1 Flags

A host MUST keep a process-wide writes-enabled flag. When it is false, tools
that use a write scope MUST be treated as unavailable.

A host SHOULD keep confirmation enabled. Confirmation MAY be disabled only
for a named development environment. Idempotency MUST remain required.

## 4.2 Input metadata

Every write tool’s public schema MUST include:

- `idempotency_key` (required, 8–200 characters)
- `confirmation_token` (optional, min 20 characters)

These fields MUST NOT be forwarded to the backend.

## 4.3 Confirmation

When confirmation is enabled and no valid receipt exists:

1. The runtime MUST NOT call the backend.
2. It MUST store a pending exact-payload request.
3. It MUST return `needs_confirmation` with `confirm_url` and `expires_at`.

The confirm page, or a trusted host confirmation API, MUST hash the payload
canonically (sorted keys, exact normalized values). A receipt is valid only
for the same session, operation, and payload hash. Receipts are single-use.

## 4.4 Idempotency

A retry with the same session, operation, and idempotency key MUST return the
stored result and MUST NOT call the backend again.

## 4.5 Confirm copy

Write metadata MUST include a title and field labels for the confirm page.
Sensitive fields MAY be hidden. Display functions MAY turn wire codes into
public labels for the page only.
