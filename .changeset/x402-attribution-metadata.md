---
'@agentcash/router': minor
---

Two x402 2.14–2.15 features surfaced through router config:

**Base Builder Codes (ERC-8021 attribution).** Set `RouterConfig.x402.builderCode` or `X402_BUILDER_CODE` (register at dashboard.base.org → Settings → Builder Codes) and the router declares the `builder-code` extension with your app code on every x402 payment challenge; the facilitator appends it to settlement calldata, attributing every settled payment to your service on-chain. Malformed codes fail at startup with a structured `invalid_builder_code` issue.

**Bazaar catalog metadata.** `DiscoveryConfig` (and `createRouterFromEnv` options) gain `serviceName`, `tags`, and `iconUrl`, forwarded into `PaymentRequired.resource` on every x402 challenge — facilitators persist them into the Bazaar discovery catalog at settlement. `serviceName` defaults to the discovery `title` when the title fits the 32-char printable-ASCII constraint, and `tags` defaults per-resource to the same route-derived tag the OpenAPI document advertises. Explicit values that violate the catalog limits fail at startup (`invalid_discovery_service_name` / `invalid_discovery_tags` / `invalid_discovery_icon_url`) instead of being silently dropped by the facilitator.
