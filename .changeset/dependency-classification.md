---
"@agentcash/router": patch
---

Reclassify dependencies by API boundary. Runtime payment libraries (`@coinbase/x402`, `@x402/core`, `@x402/evm`, `@x402/extensions`, `@x402/svm`, `mppx`, `viem`) and `zod-openapi` move from `peerDependencies` to `dependencies` — they are internal implementation details and never appear in the router's exported types. `next` and `zod` remain `peerDependencies` because their types and instances cross the public API boundary and must resolve to the host app's copy.
