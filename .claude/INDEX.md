# .claude/ Development Record

Design docs, decision records, and bug analyses for `@agentcash/router`. These document the "why" behind architectural decisions for future agents working on the codebase.

## Design (stable reference)

| File | Description |
|------|-------------|
| `route-builder-design.md` | Founding design doc. Cross-service audit, guiding principles, composition architecture, orchestration flow, auth composition, plugin interface, open source strategy, testing philosophy. Start here. |
| `route-registration-options.md` | Three approaches to route registration (manifest, self-register + barrel, central defs). Documents why Approach B was chosen. |
| `agent-discovery-final.md` | How agentcash MCP clients discover and invoke paid endpoints (Phases 0-3). Context for why OpenAPI/discovery generation matters. |

## Research (protocol reference)

| File | Description |
|------|-------------|
| `16_mpp-deep-dive.md` | MPP protocol spec, x402 comparison, challenge structure, intents, payment methods. Reference for anyone debugging MPP. |

## Resolved

| File | Version | Description |
|------|---------|-------------|
| `15_router-dynamic-pricing-solution.md` | v0.3.1 | Full derisking for early body parsing fix. Covers `request.clone()` behavior, settlement patterns, maxPrice semantics, error handling. The research on Vercel limits and clone edge cases is durable reference. |
| `14_router-dynamic-pricing-bug.md` | v0.3.1 | P0 bug: all paid routes charged maxPrice instead of dynamic price. Root cause analysis of the body-parsing-after-402 architectural issue. |
| `1_post-migration-review-fixes.md` | v0.2.0 | Post-migration review. 6 fixes including error `.status` fallback, SIWX challenge format, well-known visibility. Key decisions now enshrined in CLAUDE.md Critical Rules. |
