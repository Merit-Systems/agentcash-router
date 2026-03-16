---
"@agentcash/router": patch
---

fix(pricing): fall back to maxPrice when dynamic pricing function returns NaN

Previously, if a dynamic pricing function returned `NaN` (e.g. due to missing body fields or a calculation error), the router would propagate `NaN` as the price, causing malformed 402 challenges. Now, when the resolved price is `NaN` and a `maxPrice` is configured, the router falls back to `maxPrice`. If no `maxPrice` is set, an error is thrown.
