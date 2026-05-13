---
'@agentcash/router': major
---

Align MPP sessions with the spec's discrete-paid-unit convention. **Breaking
change** for dynamic-priced routes whose handler is a non-generator async
function that calls `charge()` multiple times — those routes must now choose
one of two shapes:

**Request-mode** (`async (ctx) => value`) — bills exactly `tickCost` per
request, regardless of handler logic. No `charge()` callback on the context.
Wire: plain HTTP with `Payment-Receipt` header (mppx
`tempo.session({ sse: false })` per the spec's "discrete paid unit" model).

**Streaming mode** (`async function* (ctx)`) — variable-cost billing via
explicit `charge()` calls in the generator. Wire: SSE with inline per-tick
voucher events (mppx `tempo.session({ sse: true })`).

The split is enforced at the type level: `charge` is only present on the
`StreamingHandlerContext` that streaming handlers receive. Request-mode
handlers calling `charge()` is a compile-time error.

**Migration**: routes that previously combined a regular `async` handler
with multiple `charge()` calls need to either:

- Rewrite as an async generator (preserves variable-cost billing, switches
  to SSE wire), or
- Drop the `charge()` calls and let the route bill exactly `tickCost` per
  request (stays on plain HTTP).

**Other changes**:

- Removed export: `DynamicHandlerContext`. Renamed to `StreamingHandlerContext`
  for clarity — it's the streaming-only handler context type.
- `RouterConfig.mpp.session` accepts `depositMultiplier` (default `10`).
  Controls the 402 challenge's `suggestedDeposit` for dynamic routes —
  client is asked to deposit `tickCost × depositMultiplier`, covering N
  requests before a topUp. Routes can override via `maxPrice`.
- Router now registers two mppx instances (sse-false and sse-true) sharing
  the same store, secretKey, and realm. Verify / settle dispatch by
  `routeEntry.streaming`.
- Request-mode dynamic settle is no longer skipped when the handler doesn't
  call `charge()` — every accepted credential bills `tickCost`. The
  credential-time auto-charge in mppx makes this consistent on the wire.
