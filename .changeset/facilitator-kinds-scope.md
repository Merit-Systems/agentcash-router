---
'@agentcash/router': patch
---

Scope each x402 facilitator client's `getSupported().kinds` to the networks
that group actually configures. Previously the EVM client returned its
facilitator's live `/supported` kinds verbatim; when the facilitator
advertised a network outside the group (e.g. CDP claiming `solana:*`), it
would win the first-write-wins slot in `x402ResourceServer.initialize()`'s
routing map and poach settle routing from the group that actually configured
that network — causing Solana settles to land at CDP instead of the
configured Solana facilitator. `extensions` and `signers` still flow through
unchanged so the upto scheme keeps the facilitator-provided fields it signs
into the Permit2 witness.
