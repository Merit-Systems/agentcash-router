---
'@agentcash/router': minor
---

Add dual-network x402 support (Base + Solana) with zero breaking changes

- New additive `x402.accepts[]` config for multi-network payment options
- Existing `payeeAddress` + `network` shorthand continues to work as before
- 402 challenges advertise all configured networks in a single response
- Verification matches the client-selected accepted requirement (not a rebuilt one)
- Settlement routes to the correct network based on the matched requirement
- SVM exact scheme registered when Solana networks are configured
- Custom (non-exact) schemes supported for Faremeter settlement-account flows
- Stable-field matching handles rotating facilitator extras (e.g. feePayer, recentBlockhash)
