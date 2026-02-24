---
"@agentcash/router": patch
---

fix: return 402 on discovery probes with empty/invalid body

When a discovery client (e.g. x402scan) sends a POST with an empty body and no
payment headers, the early body parsing returned 400 before the 402 challenge
was built. Now body parse failures with no payment header fall through to
`build402()` using `maxPrice`, ensuring resources are always discoverable.

Affects both x402 and MPP protocols. `validateFn` errors on valid bodies still
return their error status as before.
