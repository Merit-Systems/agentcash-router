---
"@agentcash/router": patch
---

Fix Base transactions failing when Solana facilitator is unavailable. Facilitator enrichments now resolve per-group — a Solana `/accepts` failure drops the Solana requirement from the challenge and logs a warning, leaving EVM requirements intact.
