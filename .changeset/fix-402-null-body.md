---
"@agentcash/router": patch
---

Fix build402 returning null body in 402 responses

The 402 challenge response now includes the payment requirements as a JSON body,
matching the SIWX challenge path. Previously the body was null despite
Content-Type: application/json, causing MCP check_endpoint to report no
paymentOptions for x402-protected routes (e.g. stableupload.dev).
