---
"@agentcash/router": minor
---

Add `payTo` option to `.paid()` for dynamic payment recipients. Accepts a static string or an async function that receives the `Request` and returns the recipient address. Falls back to the router's default `payeeAddress` when not set.
