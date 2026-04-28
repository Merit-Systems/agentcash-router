---
'@agentcash/router': minor
---

Add post-work pricing for variable-amount routes. New `.paid({ variable: true, maxPrice })` shape lets the handler decide the final settled amount via `payment.setAmount(amount)`, capped at `maxPrice`.

Two protocol wirings:

- **x402 `upto`** — requires an `upto` accept on a configured network. The override threads through `server.settlePayment(..., { amount })`; the Permit2Proxy contract enforces the cap on chain.
- **MPP sessions** (new) — requires `RouterConfig.mpp.session = { tickCost, unitType }`. Variable + MPP routes route through `tempo.session({ sse: true })`: the 402 advertises `intent="session"` with the operator's tickCost and `suggestedDeposit = maxPrice`; after the handler runs, the response is wrapped as an SSE stream where the router emits `ceil(actualAmount / tickCost)` `stream.charge()` calls before yielding the body. mppx handles channel open / voucher cycling / settlement transparently.

```ts
router
  .route('llm/generate')
  .paid({ variable: true, maxPrice: '0.10' })
  .body(GenerateSchema)
  .handler(async ({ body, payment }) => {
    const result = await runModel(body);
    payment.setAmount(result.usdCost); // <= '0.10'; '0' allowed → no charge
    return result;
  });
```

Charge credentials (transaction or hash) on a variable+MPP route are now rejected with `400` and a message pointing the client at session credentials — those charge credentials commit to a fixed amount before the handler runs and can't honor a post-work override.

Other changes:

- `RouterConfig.mpp.session?: { tickCost?: string; unitType?: string }` — opt-in, only required when at least one route uses `.paid({ variable })` over MPP.
- `SettlementEvent.amount` carries the effective settled amount (post-work override ?? originally quoted price).
- SIWX entitlement is no longer granted when the effective settled amount is `0`.
- Variable + EVM routes auto-include `eip2612GasSponsoringExtension` in the 402 challenge so first-time clients without a Permit2 allowance can sign a gasless permit in the same flow.
