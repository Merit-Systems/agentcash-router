---
'@agentcash/router': patch
---

Emit `security: []` in `/openapi.json` for routes built with `.unprotected()`. Per OpenAPI 3.x, an empty security array on an operation explicitly overrides any global security requirement — the spec-native way to declare a route as public. Previously, unprotected routes emitted no `security` field at all, which is indistinguishable from "author forgot to declare auth" and caused `@agentcash/discovery` (and any other OpenAPI consumer) to flag the route as missing an auth mode. Pairs with `@agentcash/discovery >= 1.6.6`, which reads `security: []` as `authMode: 'unprotected'`. Older discovery versions and other OpenAPI tooling ignore it — no regression.
