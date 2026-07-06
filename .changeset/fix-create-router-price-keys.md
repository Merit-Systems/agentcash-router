---
'@agentcash/router': patch
---

Fix `createRouter` price-key inference when `RouterConfig` is passed without a `prices` map. Restores per-route `.paid()` typechecking for apps that declare config as `RouterConfig`.
