---
"@agentcash/router": minor
---

Add `mpp.session.settlementSchedule` to enable mppx's server-side automatic settlement cadence. Sessions can now settle in the background once a `units`, `amount`, or `intervalMs` threshold is crossed instead of on every request/tick, reducing on-chain settles and gas. Omit it to keep the existing per-request behavior. Requires `mpp.session` and `mpp.operatorKey`.

Bumps `mppx` to `^0.7.0` (formal `session` MPP intent + Tempo TIP-1034 reserve-precompile gas reductions) and `viem` to `^2.51.0` to satisfy mppx's peer requirement.
