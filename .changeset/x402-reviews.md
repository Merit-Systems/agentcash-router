---
'@agentcash/router': minor
---

Add opt-in buyer reviews: `RouterConfig.x402.reviews: true` declares the x402 `reviews` extension (x402-foundation/x402#3656) with an Agorean `read` link on every x402 challenge, and a `write` link naming the settled transaction (`https://agorean.com/r/<tx_hash>`) in every `PAYMENT-RESPONSE`. Off by default; no network calls.
