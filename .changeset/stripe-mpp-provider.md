---
'@agentcash/router': minor
---

Add Stripe as an alternative MPP provider. Setting `STRIPE_SECRET_KEY` auto-selects Stripe MPP, disables x402, and frees the deployment from needing `EVM_PAYEE_ADDRESS`, an operator/fee-payer key, or a Tempo RPC. On each 402 the router mints a fresh Stripe crypto-deposit `PaymentIntent` and uses the returned Tempo address as the MPP recipient; Stripe captures the USDC on settlement and credits the merchant's Stripe balance.

Stripe and x402 (or Stripe and Tempo MPP) cannot both be configured — the env validator throws `stripe_x402_conflict` / `stripe_tempo_conflict` at build time. `.metered()` is unsupported in Stripe mode because Stripe's `mppx` integration is charge-only; the builder throws with a Stripe-specific message at route registration. Requires the new optional peer dependency `stripe`.

`RouterConfig.mpp` is now a discriminated union — the existing fields are the `{ provider: 'tempo' }` variant (default when omitted), and `{ provider: 'stripe', stripeSecretKey }` is the new variant.
