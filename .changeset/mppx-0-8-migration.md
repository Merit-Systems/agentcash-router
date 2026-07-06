---
'@agentcash/router': minor
---

Migrate to mppx 0.8.x (TIP-1034 sessions) and viem ≥2.54.

`mppx ^0.6.16 → ^0.8.5`: MPP session challenges are now TIP-1034 reserve-precompile sessions (`sessionProtocol: "v2"`, escrow `0x4d5050…`) — the format current clients expect. The `agentcash` CLI ≥0.16 (mppx 0.8.x) can now open sessions against `.metered()` routes; on the old server it failed session negotiation entirely. One-shot MPP charge, x402 (exact/upto), SIWX, and entitlement replay are wire-unchanged.

`viem ^2.47.6 → ^2.54.0`: mppx 0.8.3+ requires viem ≥2.54 (Tempo transfer call builders moved to the two-argument convention); pnpm silently satisfies the peer range with the host copy, so the router's own floor must be ≥2.54 or every non-zero Tempo charge fails at credential verify.

Compatibility notes:

- Clients on mppx <0.7 (e.g. `agentcash` CLI ≤0.15) can no longer open MPP **sessions** against the router — they sign the legacy v1 flow against the v2 precompile and revert. Those CLI versions also fail one-shot MPP charge due to a client-side response-clone bug fixed in newer releases. x402 routes are unaffected for all clients.
- Fee-sponsored (gas-sponsored) flows now pass mppx's sponsor policy checks (0.6.16 rejected current clients' fee budgets outright). Sponsorship requires the `MPP_FEE_PAYER_KEY` account to hold the Tempo fee token (pathUSD) — with an unfunded sponsor, verification fails at broadcast with `insufficient funds for gas`.

Internal: mppx stopped exporting the SSE `SessionController` type from a public subpath; the router now declares the structural equivalent locally. The middleware contract (`charge/session → 402 challenge | 200 withReceipt`), `Credential.fromRequest`, session credential actions (`open/topUp/voucher/close`), and the `Store.upstash` atomic-store adapter are all unchanged.
