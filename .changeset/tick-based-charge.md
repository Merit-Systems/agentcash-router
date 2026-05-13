---
'@agentcash/router': minor
---

Add x402 `upto` and MPP payment-channel sessions.

**x402 `upto`** — handler-driven dynamic pricing on x402, with the cumulative
atomic amount overriding `requirements.amount` at settle time. Permit2Proxy
enforces `actual ≤ permitted.amount` on chain. Configure via
`x402.accepts: [{ scheme: 'upto', network, asset, decimals }]`.

**MPP sessions** — long-lived payment channels (open / voucher / topUp / close)
for dynamic-priced MPP routes. SSE streaming bridges the handler's `charge()`
calls to per-tick channel debits, with `payment-need-voucher` back-pressure
handled transparently by mppx.

**Tick-based `charge()` API** — `HandlerContext.charge` is a no-arg event:
`() => Promise<void>`. One call = one tick = `tickCost` USDC = one
route-defined unit (token, byte, frame). To bill N units, call `charge()` N
times. Total billed is `tickCost * call_count`, capped at `maxPrice`. Calling
`charge` zero times means the request runs free — no on-chain transfer.

```ts
router
  .route('llm/generate')
  .paid({ dynamic: true, tickCost: '0.0005', unitType: 'token', maxPrice: '0.10' })
  .body(z.object({ prompt: z.string() }))
  .handler(async ({ body, charge }) => {
    const { tokens, output } = await callLLM(body.prompt);
    for (let i = 0; i < tokens; i++) await charge();
    return { output };
  });
```

`tickCost` is required at the route level on `.paid({ dynamic: true })` —
the builder throws at registration if it's missing. Streaming handlers
(`async function*`) follow the same `charge()` contract.
