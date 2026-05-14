---
'@agentcash/router': patch
---

Fix float-precision bug in dynamic and tiered pricing caps. Both cap paths
previously used `parseFloat` to compare USDC decimal strings — a payments
library doing float comparison on money — which could mis-cap prices near
6-decimal boundaries.

Consolidated all money-handling primitives into `src/pricing/format.ts`
(`decimalToAtomic`, `atomicToDecimal`, `compareDecimals`, `isPositiveDecimal`,
`multiplyDecimal`) and rewired the existing call sites:

- `DynamicPricing` cap and `TieredPricing.maxTierPrice` now compare in bigint.
- `builder.ts` price/tickCost/maxPrice validators use `isPositiveDecimal`.
- `discovery/openapi.ts` tier min/max selection compares in bigint.
- `protocols/x402/requirements.ts` inline decimal→atomic helper replaced.
- `protocols/mpp/strategy.ts` local `multiplyDecimal` deleted in favor of the
  shared one.
- Removed `src/pricing/atomic.ts` (folded into `format.ts`).

No public API change. Pricing config strings that previously over-truncated
fractions beyond 6 decimals (e.g. `"0.0000001"`) now fail validation at
configuration time instead of silently rounding to zero.
