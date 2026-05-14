---
'@agentcash/router': patch
---

Cache the x402 facilitator `/supported` response in the configured `kvStore`
(1h TTL under `x402:facilitator-supported:<url>`) so serverless cold starts
don't all re-fetch from the facilitator. Declare the `eip2612GasSponsoring`
challenge extension whenever any configured x402 accept is `upto` on an EVM
network. Behavior is unchanged for routers without a `kvStore` and routes
without an EVM upto accept.
