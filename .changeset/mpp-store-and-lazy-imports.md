---
'@agentcash/router': patch
---

MPP session channels now use one shared store across the request-mode and streaming middlewares (previously each defaulted to a private in-memory store, so a channel opened through one was `channel-not-found` through the other). Protocol-heavy dependencies (`mppx`, `viem/tempo`, `@x402/evm`, …) are now loaded lazily at their call sites instead of statically, so x402-only deployments no longer bundle the MPP dependency tree (and vice versa) — this also removes the webpack "Critical dependency" warning from `ox/tempo` in Next.js apps that don't use MPP.
