# .claude/ Development Record

Design docs, decision records, and bug analyses for `@agentcash/router`. These document the "why" behind architectural decisions for future agents working on the codebase.

## Design (stable reference)

| File | Description |
|------|-------------|
| `route-builder-design.md` | Founding design doc. Cross-service audit, guiding principles, composition architecture, orchestration flow, auth composition, plugin interface, open source strategy, testing philosophy. Start here. |
| `route-registration-options.md` | Three approaches to route registration (manifest, self-register + barrel, central defs). Documents why Approach B was chosen. |
| `agent-discovery-final.md` | How agentcash MCP clients discover and invoke paid endpoints (Phases 0-3). Context for why OpenAPI/discovery generation matters. |

## In Progress

| File | Description |
|------|-------------|
| `20_dual-network-x402-solana-plan-2026-03-11.md` | Proposed plan for adding Solana mainnet USDC alongside Base USDC with one route, zero breaking changes, separate per-chain recipients, and likely Faremeter-backed downstream wallet compatibility. |
| `18_facilitator-429-cold-start-fix.md` | P0 bug: facilitator `/supported` 429 rate limits on Vercel cold starts cause bare 402 pass-through on all paid routes. Root cause (2 bugs), full timeline of prior fix attempts across enrichx402/x402/router, upstream npm gap, solution (hardcode getSupported for EVM exact + 500 safety net), testing methodology. |
| `21_x402-upto-research.md` | Reference notes on how upstream `x402` implements the `upto` scheme — spec MUSTs, three-layer TS implementation (`UptoEvmScheme`, `settlePayment` overrides, HTTP `Settlement-Overrides` header), pointers to source. Companion to plan 22. |
| `22_post-work-pricing-plan.md` | Implementation plan for post-work pricing. Phase 1: `.paid({ variable, maxPrice })` + `payment.setAmount()` for x402 `upto` and MPP charge. Phase 2 (future): `.session({ perUnit })` + `payment.tick()` for MPP sessions/streaming. API designed so the two phases share the `payment` context cleanly. |
| `23_post-work-pricing-handoff.md` | Session-resume doc for the post-work-pricing work. Captures the the-stables backward-compat analysis, the MPP push-vs-pull narrowing, the mppx-bump-first sequencing, and a flat implementation checklist. Read this before resuming work on docs 21/22. |

## Research (protocol reference)

| File | Description |
|------|-------------|
| `16_mpp-deep-dive.md` | MPP protocol spec, x402 comparison, challenge structure, intents, payment methods. Reference for anyone debugging MPP. |

## Resolved

| File | Version | Description |
|------|---------|-------------|
| `17_mpp-payment-flow-tests.md` | v0.5.0 | MPP payment flow test plan. 5 tests mirroring x402 coverage: probe challenge, valid credential, invalid credential, handler error, wallet context. Mock at protocol module boundary. |
| `router-v0.5-execution-plan.md` | v0.5.0 | 7-phase DevX improvements from StableStudio migration: wallet normalization (lowercase), SIWX error codes, expiry constant, Redis nonce store, SIWX client export, `onAuthVerified` hook, `.paid().siwx()` guard. |
| `fix-mpp.md` | v0.4.1 (superseded) | MPP support: NextRequest→Request conversion, challenge generation, body stream consumption bug. **Superseded:** `src/protocols/mpp.ts` deleted in favor of `Mppx.create()` high-level API. `toStandardRequest()` and all manual protocol plumbing eliminated. |
| `15_router-dynamic-pricing-solution.md` | v0.3.1 | Full derisking for early body parsing fix. Covers `request.clone()` behavior, settlement patterns, maxPrice semantics, error handling. The research on Vercel limits and clone edge cases is durable reference. |
| `14_router-dynamic-pricing-bug.md` | v0.3.1 | P0 bug: all paid routes charged maxPrice instead of dynamic price. Root cause analysis of the body-parsing-after-402 architectural issue. |
| `1_post-migration-review-fixes.md` | v0.2.0 | Post-migration review. 6 fixes including error `.status` fallback, SIWX challenge format, well-known visibility. Key decisions now enshrined in CLAUDE.md Critical Rules. |
