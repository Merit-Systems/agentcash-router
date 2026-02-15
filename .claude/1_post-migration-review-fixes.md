# Decision Record: Post-Migration Review Fixes

**Date:** 2026-02-14
**Status:** Resolved in v0.2.0
**Scope:** @agentcash/router v0.2.0

After porting stablestudio to `@agentcash/router` + `@agentcash/telemetry`, a Carmack-level review found critical bugs and cleanup items. This record covers the router-side fixes.

## Changes

### Fix 1: safeCallHandler respects `.status` on any error (CRITICAL)

`handler.ts` only checked `instanceof HttpError`. The universal `Object.assign(new Error(), { status })` pattern was silently mapped to 500. Added fallback: if `error.status` is a number, use it.

### Fix 2: SIWX 402 challenge is now a proper x402v2 challenge (CRITICAL)

`orchestrate.ts` SIWX branch returned a bare `HTTP 402 (empty body)` with `X-SIWX-REQUIRED: true`. MCP tools need a full x402v2 challenge with `PAYMENT-REQUIRED` header and JSON body containing `extensions['sign-in-with-x']` with `domain`, `uri`, `version`, `chainId`, `type`, `nonce`, `issuedAt`. Replaced with proper challenge builder.

### Fix 3: Well-known includes SIWX routes

`well-known.ts` filtered by `protocols.includes('x402')`. SIWX routes have `protocols: []`. Changed to `authMode !== 'unprotected'` — any route returning a 402 challenge should be discoverable.

### Fix 4: OpenAPI method tracking + path merging

- `types.ts`: Widened `RouteEntry.method` to `'GET' | 'POST' | 'DELETE' | 'PUT' | 'PATCH'`.
- `builder.ts`: Added `.method()` setter.
- `openapi.ts`: Changed path assignment from overwrite to merge (`{ ...paths[apiPath], [method]: op }`).

### Fix 5: Well-known URL deduplication

Routes sharing the same path (e.g., GET + DELETE on `/jobs/{jobId}`) produced duplicate URLs. Switched to `Set<string>` for dedup.

### Fix 6: Design philosophy comments

Added inline comments explaining non-obvious design decisions: error tolerance, SIWX challenge format, discovery completeness, path merging, protocol array semantics.

## Test Impact

- Updated `discovery.test.ts`: SIWX routes now included in well-known (was: excluded)
- Added 5 new tests: dedup, description, CORS headers, `.status` fallback on plain errors
- All 108 tests pass
