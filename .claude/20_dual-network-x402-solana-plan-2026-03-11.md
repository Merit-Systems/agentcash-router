# Dual-Network x402 Solana Plan

**Date:** 2026-03-11 20:26:42 EDT
**Last Updated:** 2026-03-11 23:44:00 EDT
**Status:** In Progress
**Target:** `@agentcash/router` dual-network x402 support with Base USDC + Solana USDC

## High-Level Goal

Add Solana mainnet USDC support to `agentcash-router` without breaking existing Base USDC integrations.

The preferred end state is:

- one paid route definition
- one primary payment flow for consumers
- one 402 challenge that can advertise both Base and Solana payment options
- zero breaking changes for existing router consumers
- separate recipient addresses per chain

## Product Philosophy

The constraints from product are clear and should drive the implementation:

- Prefer simplicity over maximal flexibility.
- Preserve the current happy path for existing Base users.
- Avoid config churn and API breakage unless the old surface is unsalvageable.
- Support downstream wallets that matter in practice, not just protocol purity.
- If Solana requires Faremeter for the real client ecosystem, optimize for that path instead of carrying two parallel Solana settlement stories.

## Decisions Locked In

1. A single paid route should be able to advertise both Base and Solana.
2. Solana target is mainnet only.
3. Base and Solana recipients are separate because the address formats differ.
4. Zero breaking changes are required.
5. The downstream clients that matter are:
   - `lobster.cash`
   - the local `agentcash` wallet in `~/Documents/code/merit-systems/agentcash`
6. Faremeter is believed to be required for special downstream wallets, especially smart-wallet flows, and the implementation should aim for one settlement happy path if possible.

## Execution Status

The router-side plumbing is now implemented and covered:

- additive `x402.accepts[]` config preserves backward compatibility with existing `payeeAddress` + `network`
- one route can now advertise multiple payment options, including:
  - Base `exact`
  - Solana `exact`
  - custom Solana schemes such as `@faremeter/x-solana-settlement`
- verification and settlement now follow the client-selected requirement instead of assuming one global network
- custom non-`exact` accepts are validated and converted into explicit x402 requirements

Automated verification status:

- `pnpm test`: passed on 2026-03-11
- `pnpm typecheck`: passed on 2026-03-11
- focused integration coverage now includes a route advertising both Solana `exact` and `@faremeter/x-solana-settlement`

Remaining unproven work is no longer router architecture. It is real client compatibility with the Faremeter wallet paths, especially smart-wallet settlement flows.

## Live Validation Findings

Live Solana validation against `https://facilitator.corbits.dev` is now split into two concrete results:

- `@faremeter/x-solana-settlement` is not currently exposed by the hosted Corbits facilitator as a usable v2 payment option.
  - `GET /supported` only advertises Solana `exact`
  - `POST /accepts` with an explicit `@faremeter/x-solana-settlement` CAIP-2 v2 accept returns `accepts: []`
  - when the router enriches a mixed route through `/accepts`, the hosted facilitator collapses the route to `exact` options only
- Faremeter Solana `exact` does work end-to-end against the hosted Corbits facilitator.
  - the live route advertised Base `exact`, Solana `exact`, and `@faremeter/x-solana-settlement`
  - challenge enrichment through `/accepts` returned Solana `exact` with `feePayer`, `recentBlockhash`, `decimals`, and `xSettlementAccountSupported`
  - a funded local Solana keypair wallet using `@faremeter/payment-solana/exact` settled successfully on mainnet
  - successful settlement transactions observed:
    - `DG5nLCf3ykBkLWfUNyABqfMasPACktfK5YHPL7Rg4N2Ypqv121g6Jc3P7k7CaRWR38n2hfh8dYpWWYxzgNf2ax9`
    - `aPm5hF6VzjFwi7EGhzrptvjdMxMFLim21mkkbVJU2ySAAD3GPfUgrEwVmv7bzsPnGeyGvNsghQmyYyCrJaY4BNT`

Practical conclusion:

- the production-compatible Solana path on Corbits today is `exact`
- smart-wallet support likely rides on `exact` plus `extra.features.xSettlementAccountSupported`, not on a separately advertised `@faremeter/x-solana-settlement` option
- router support for custom schemes is still useful, but it should not be assumed to match the live hosted Corbits surface

## Compaction-Safe Confirmed Discoveries

These are facts we have directly confirmed from live behavior or local source execution and can rely on across future compactions.

### Lobster Wallet Setup

- `@crossmint/lobster-cli` setup completed successfully for local agent id `router-live`.
- The local Lobster signer address is `AboGXxobby4rgwCCwES3tPBgHeUp1HDBTbMvRNJLnaex`.
- The Lobster smart wallet address is `EidQ7rA7y8mEat3acGuQHng8UR6G3JbhzKFEduh9HDU`.
- Lobster wallet state is stored locally in `.lobster/wallets.json`.

### Lobster Wallet Funding

- The Lobster smart wallet now holds test funds on Solana mainnet.
- `0.1 USDC` was transferred into the Lobster smart wallet ATA.
- The USDC transfer signature was `22GXYcJXpuuDeXSDnCWGsjRrJQfzSBGz2wTpQ7BPajaigN1ho6Ds4j8Ph8MGareHic4zdHBtu9n9Ro6ouZnPUAcP`.
- An additional `2.0 USDC` was later transferred into the same Lobster smart wallet ATA.
- That follow-up USDC transfer signature was `23T8P47EbroXjse7oMGH3am99xQvKuCSzrRj7waqPuJRx7PddtLWBg69aRFsohawqpNb8nXMVrE6E2AmVQ1Sg5PP`.
- `0.01 SOL` was transferred into the Lobster smart wallet.
- The SOL transfer signature was `EYFaSzhyouRd3CYtPZikv8LKKFcTE8Cj68Lte3cUwABbjw1k7gvtzBwjca9Nnfz6rMn2AuoRCftWhLUAWHGh3uC`.

### Hosted Corbits Behavior

- Hosted `https://facilitator.corbits.dev/supported` currently advertises Solana `exact`, not `@faremeter/x-solana-settlement`.
- Hosted `https://facilitator.corbits.dev/accepts` returned an empty `accepts` array for an explicit legacy-style `@faremeter/x-solana-settlement` request on `mainnet-beta`.
- Hosted Corbits Solana `exact` challenge enrichment still works and includes the expected Solana metadata for exact flows.

### Local Faremeter Settlement Findings

- `@faremeter/x-solana-settlement/facilitator` is a legacy v1 handler and must be wrapped with `adaptHandlerV1ToV2(...)` to behave correctly in a v2 facilitator surface.
- Without that adapter, the router-facing facilitator loop did not produce usable settlement accepts.
- After wrapping with `adaptHandlerV1ToV2(...)`, the local facilitator `/supported` surface included `@faremeter/x-solana-settlement`.
- With the adapted local facilitator, the router emitted a v2 `PAYMENT-REQUIRED` challenge that contained `@faremeter/x-solana-settlement` plus facilitator `extra.admin` and `extra.recentBlockhash`.

### Settlement Client Findings

- `@faremeter/x-solana-settlement` client code supports `token.allowOwnerOffCurve`.
- The Lobster smart-wallet settlement attempt reached the `@faremeter/x-solana-settlement` client handler and failed with `TokenOwnerOffCurveError` before payment submission when `allowOwnerOffCurve` was not enabled.
- After enabling `token.allowOwnerOffCurve` and refreshing Lobster auth, the Lobster smart-wallet settlement attempt progressed to Lobster proxy transaction simulation.
- Lobster proxy then rejected the serialized `@faremeter/x-solana-settlement` transaction with `TRANSACTION_SIMULATION_FAILED`.
- The returned simulation logs ended with:
  - `Program swigypWHEksbC64pWKwah1WTeh9JXwx8H1rJHLdbQMB failed: Unsupported program id`
- This proves the Lobster proxy is currently rejecting the `@faremeter/x-solana-settlement` on-chain program during simulation.

### Lobster Exact Findings

- The Lobster/Crossmint `exact` payment path produces a four-instruction client transaction before proxy submission:
  - compute unit limit
  - compute unit price
  - associated token account create-idempotent
  - SPL `TransferChecked`
- Before the wallet top-up, Lobster proxy rejected this `exact` smart-wallet payment attempt with `TRANSACTION_SIMULATION_FAILED`.
- The returned simulation logs showed a second `TransferChecked` failing with `insufficient funds` inside the Lobster/Crossmint smart-wallet execution path.
- After funding the Lobster smart wallet with an additional `2.0 USDC`, the hosted Corbits `exact` flow succeeded end-to-end.
- Successful Lobster exact settlement transaction:
  - `2M1gnMKHTNNj871HDboo1j8kbB9jKfbP1UApqP7MbfNGWyhoLXGAWHK7W4QNcrF5NofbnUsx7BJytwCk3oeQDRjp`
- A second consecutive hosted Corbits Lobster exact run also succeeded end-to-end.
- Second successful Lobster exact settlement transaction:
  - `MBQohBDQEEoLG6thi1RGUBkJ5jdGPfTDHwryt9TBChxGkoCfXcWMpYrvTVerLNBGQeHBzgXuWNfFRkuJ1yxmjrv`
- The hardened live harness now:
  - refreshes Lobster auth automatically through `withAuthenticatedApi(...)`
  - prints current smart-wallet balances before attempting payment
  - fails early if balances are below configured minimums
  - surfaces structured `ProxyApiError` details instead of opaque generic failures

## Confirmed Upstream Facts

### Coinbase x402

The current Coinbase x402 repo already contains first-party SVM support:

- Solana mainnet CAIP-2 network string is `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp`.
- `@x402/svm` exists and provides resource-server and facilitator helpers.
- `registerExactSvmScheme(server)` exists for resource servers.
- Solana exact payment requirements depend on facilitator metadata such as `feePayer`.

This means Solana is not blocked by upstream protocol support. The missing work is in router integration and settlement-path selection.

### Current Router Limitations

The current router is structurally single-network:

- `RouterConfig` exposes one `payeeAddress` and one `network`.
- x402 challenge generation builds exactly one payment option.
- x402 verification rebuilds exactly one payment option before matching.
- server bootstrap only registers EVM exact support.
- cold-start optimization hardcodes a single EVM `getSupported()` response.

That hardcoded optimization is acceptable for Base-only EVM exact flows, but it is incompatible with real multi-network support and especially with Solana, where supported-kind metadata is load-bearing.

### Faremeter

The Faremeter docs describe a facilitator and middleware model that is not just a thin alias over Coinbase's standard `/supported` + `/verify` + `/settle` HTTP facilitator shape.

Important behaviors:

- facilitator surface is centered around `/accepts` and `/settle`
- handlers are registered one per network
- middleware can advertise alternative requirement sets such as `[[solanaRequirement, evmRequirement]]`
- route authors can keep one paywalled route while exposing multiple acceptable payment rails

That aligns closely with the product goal of "one route, one user-facing flow, multiple settlement rails."

### Faremeter Source and Live Corbits Validation

The Faremeter codebase and the hosted Corbits deployment materially reduce the main Solana settlement risk.

Confirmed from source:

- the Faremeter facilitator app currently wires both legacy Solana settlement handlers and the newer Solana exact handler
- the Solana exact handler supports an additional settlement-account branch inside the `exact` scheme
- that branch is gated by `enableSettlementAccounts` on the facilitator side and `extra.features.xSettlementAccountSupported` in requirement metadata
- normal signing wallets can still use the standard partially-signed transaction path under the same `exact` scheme

Relevant source files:

- `~/Documents/code/faremeter/facilitator/apps/facilitator/src/solana.ts`
- `~/Documents/code/faremeter/facilitator/packages/payment-solana/src/exact/client.ts`
- `~/Documents/code/faremeter/facilitator/packages/payment-solana/src/exact/facilitator.ts`
- `~/Documents/code/faremeter/facilitator/packages/facilitator/src/routes.ts`

Confirmed from live hosted endpoints:

- `https://facilitator.corbits.dev/supported` is live
- it advertises Solana mainnet as `exact` for both x402 v1 and x402 v2
- the x402 v2 Solana mainnet network string is `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp`
- the supported Solana entries include `extra.features.xSettlementAccountSupported: true`
- `POST https://facilitator.corbits.dev/accepts` with a single Solana v2 exact requirement returns one canonicalized Solana requirement with `feePayer`, `decimals`, `recentBlockhash`, and the settlement-account feature flag
- `POST https://facilitator.corbits.dev/settle` with an invalid normal Solana exact payload reaches the normal exact validation path
- `POST https://facilitator.corbits.dev/settle` with an invalid settlement-account-style payload reaches the settlement-account branch and fails on key validation, which proves that branch is live in production

Practical conclusion:

- one Solana `exact` happy path appears viable
- regular wallets can use partial-sign exact flow
- smart-wallet or PDA-style clients can use the settlement-account variant behind the same scheme
- the remaining interoperability risk is now mostly client-side, not facilitator-side

One robustness concern remains:

- malformed settlement-account requests currently produced a `500` from the hosted facilitator instead of a cleaner validation error

That is a Corbits/Faremeter bug, but it does not change the architectural conclusion that the branch is enabled and live.

### Live Merchant Behavior

Hosted Corbits merchant endpoints were also probed:

- `https://triton.api.corbits.dev/`
- `https://helius.api.corbits.dev/`

Both currently return 402 responses advertising:

- Solana mainnet USDC exact
- Base exact
- Monad exact

Important observation:

- both live merchant responses included two identical Solana mainnet exact offers
- replaying a single Solana requirement through `https://facilitator.corbits.dev/accepts` returned only one Solana result

Conclusion:

- the duplicate Solana offers are not coming from the facilitator canonicalization layer
- duplication is likely caused by merchant-side config or middleware behavior
- this is useful as a cautionary regression to avoid in `agentcash-router`

## Recommended API Direction

### Recommendation

Keep the current config working exactly as-is, and add an additive multi-network x402 config.

Do not replace:

```ts
createRouter({
  payeeAddress,
  network,
  ...
})
```

Instead, treat it as shorthand for a single x402 accept configuration.

Add a new optional config shape conceptually like:

```ts
createRouter({
  payeeAddress,
  network,
  x402: {
    accepts: [
      {
        network: "eip155:8453",
        payTo: "...",
      },
      {
        network: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
        payTo: "...",
      },
    ],
  },
  ...
})
```

The exact naming can change, but the principles should not:

- additive
- backward compatible
- explicit once multi-network is needed
- route logic stays unchanged

### Why This Is The Right Tradeoff

- It satisfies zero-breaking-change requirements.
- It keeps the simple Base-only setup simple.
- It avoids overloading `payeeAddress` and `network` with ambiguous array semantics.
- It cleanly maps to the actual x402 requirement-building model, which already wants an array of options.

## Recommended Settlement Strategy

### Preferred Direction

Aim for one Solana settlement path, and prefer the one that actually works for `lobster.cash` and the `agentcash` wallet.

Given the current information, that probably means:

- Base continues through the existing Coinbase x402 HTTP facilitator path.
- Solana should use a Faremeter-backed path if that is what the real downstream wallets require.

If Faremeter fully covers the Solana wallet compatibility problem, it should be treated as the canonical Solana settlement path rather than an optional fallback.

### What This Implies Technically

The router likely needs one of these architectures:

1. mixed facilitator clients behind one router x402 flow
2. an adapter that lets router generate multi-network challenges while delegating Solana settlement to Faremeter semantics
3. a deeper Faremeter-style x402 path for both Base and Solana, if that turns out to simplify downstream compatibility

Current bias:

- do not migrate Base unless necessary
- isolate the Solana-specific facilitator path
- preserve one route-builder API and one external user-facing payment flow

## Implementation Plan

### Phase 1: Config and Type Design

- Add additive multi-network x402 config.
- Preserve `payeeAddress` + `network` shorthand.
- Resolve effective x402 accepts at router creation time.
- Enforce that each accept has its own `network` and `payTo`.

### Phase 2: Server Bootstrap

- Add `@x402/svm` as a peer dependency and dev dependency.
- Register both EVM and SVM exact server schemes.
- Replace the EVM-only cached `getSupported()` shortcut with something multi-network-safe.
- Keep cold-start protection, but only where the optimization is actually valid.

### Phase 3: Challenge Generation

- Build payment requirements from multiple options instead of one.
- Emit one 402 challenge containing both Base and Solana accepts.
- Preserve current behavior for single-network configs.

### Phase 4: Verification and Settlement

- Stop assuming a single network during verification.
- Rebuild the same effective requirement set that was used to create the challenge.
- Match the incoming accepted requirement against that full set.
- Settle against the matched requirement rather than a globally assumed network.

### Phase 5: Facilitator Integration

- Decide and implement the Solana settlement client path.
- If Faremeter is required, isolate that adapter behind the router's x402 abstraction boundary.
- Keep the external route-builder API unaware of facilitator complexity.

### Phase 6: Testing

Add tests for:

- backward compatibility of existing Base-only config
- dual-network 402 challenge emission
- correct matching of Base settlement vs Solana settlement
- init failures when supported kinds are unavailable
- Solana mainnet network string handling
- discovery/probe behavior with multi-network accepts

### Phase 7: Documentation

- Update README with single-network and dual-network examples.
- Document the Solana mainnet string explicitly.
- Document separate per-chain recipient addresses.
- Document facilitator-mode expectations for downstream wallet compatibility.

## `agentcash-discovery` Impact

Current expectation: low to medium impact.

The discovery package already has partial Solana awareness:

- Solana CAIP-2 normalization exists
- v2 payment option extraction is generic
- payment-required validation already includes Solana coverage

Likely follow-up work:

- add router-generated dual-network fixtures
- verify output quality in probe/check flows
- patch only if real router output exposes a parser or normalization gap

This should be treated as a second-order repo unless implementation proves otherwise.

## Open Risks To Resolve During Build

1. Whether `lobster.cash` already supports the exact settlement-account payload shape that the hosted Corbits facilitator expects.
2. Whether the local `agentcash` wallet should converge on the same Solana exact-plus-settlement-account path as `lobster.cash`.
3. How much of the existing cold-start supported-kinds optimization can be preserved safely.
4. How to avoid merchant-side duplicate Solana offers when one route advertises multiple rails.

## Inputs Still Needed Later

When implementation begins and settlement testing starts, the following will be needed:

- Solana facilitator private key
- confirmation of mainnet RPC endpoint to use
- Solana recipient public key
- Faremeter credentials / keys / deployment details
- confirmation of whether the same Solana signer is also the fee payer

## Local Solana Test Keys And Funding Plan

Local mainnet test keys have now been generated and stored in the gitignored local env file:

- `.env`

The local env currently includes:

- `CORBITS_FACILITATOR_URL=https://facilitator.corbits.dev`
- `SOLANA_MAINNET_CAIP2=solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp`
- facilitator fee-payer keypair
- merchant recipient keypair
- client payer keypair

Public addresses for funding:

- facilitator fee payer: `Ds816HdDnvbNuqduycXHVT4KtdDzLUovRAM3UhQB166D`
- merchant payee: `5ivLTFuhasc9s1jcx2hHQ8YWXr8KydvPb6tgZzCpVq2n`
- client payer: `Dab79sHmXeVHrPtihcbguwvwRF3Q5gCc3ghWPMoVoi86`

Recommended initial funding for live validation:

- facilitator fee payer: enough SOL to sponsor multiple transactions on mainnet
- client payer: a small SOL balance for wallet-side flows that may submit directly
- client payer: enough mainnet USDC for repeated test purchases

Practical minimums for a first pass:

- facilitator fee payer: ~`0.05 SOL`
- client payer: ~`0.02 SOL`
- client payer: ~`2-5 USDC`

Current funded state as of 2026-03-11:

- facilitator fee payer has been funded and is now paying live test transaction fees
- merchant payee was accidentally funded with `5.01 USDC` and then drained back out
- client payer now holds `5.01 USDC`
- facilitator fee payer balance is approximately `0.04794572 SOL` after paying ATA creation and transfer fees

Live rebalancing transaction executed on 2026-03-11:

- USDC mint confirmed on-chain as `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`
- client ATA created as `4EvwPczrcPXXbF32eWrfAiMV8ZtsSk9AdjueH8HSEaqW`
- transfer signature: `4EaadQKN4aVvzdqQDrGapDMbWo91YwwmkxVcYhayBmr4HQZFoFXRZ8iin6MRk88he2N3Yeh3nhexWTvqWoRV3xht`
- execution model: facilitator paid the network fee, merchant signed as token authority, client received the full `5.01 USDC`

### Live Testing Plan

1. Fund the facilitator fee-payer and client payer addresses on Solana mainnet.
2. Keep the merchant payee effectively unfunded for SOL; facilitator-paid transactions are sufficient when moving test funds between merchant and client wallets.
3. Point local validation at `https://facilitator.corbits.dev` first.
4. Validate `/supported` and `/accepts` against the funded keys to confirm the live environment still advertises Solana exact with settlement-account support.
5. Run a Base control payment through the existing AgentCash wallet path to confirm no regression.
6. Run a Solana exact payment against the router using the generated client wallet.
7. Run a Solana smart-wallet-compatible payment path if available, to confirm settlement-account behavior against the hosted facilitator.
8. If hosted Corbits behavior diverges from what the router needs, switch to a dedicated facilitator deployment using the same env structure.

Live smoke harness added in repo:

- `scripts/live-x402-smoke.mjs`
- `pnpm test:live:solana`

What the live smoke test now proves:

- the router can emit one dual-network `402` challenge with both Base and Solana
- the router now verifies and settles against the client-selected accepted requirement instead of rebuilding dynamic facilitator extras on retry
- this closes the real Solana regression where rotating facilitator-provided fields like `feePayer` could invalidate a correct client payload

What the live smoke test still fails on:

- Corbits `/verify` returns `{"isValid":false,"invalidReason":"Invalid transaction"}` for a real Solana payload generated from the funded client wallet
- the failure reproduces both with the repo's pinned `@x402/svm@2.3.0` and with an isolated `@x402/svm@2.6.0` probe, so this is not just an npm package-version mismatch
- the remaining blocker is therefore client-transaction compatibility with the hosted Corbits facilitator, not router challenge emission or wallet funding

Immediate next debugging target:

- compare the transaction produced by Coinbase `@x402/svm` against the transaction format expected by Corbits/Faremeter for Solana exact verification
- if Corbits expects a different client payload contract, the router will need a Corbits-specific Solana client path or facilitator adapter rather than relying on native Coinbase SVM exact compatibility alone

## Faremeter Source-Of-Truth Findings

After tracing the local Faremeter checkout in `~/Documents/code/faremeter/facilitator`, the intended Solana integration path is clearer than the public docs suggest.

Key source files:

- `apps/facilitator/src/solana.ts`
- `packages/payment-solana/src/exact/client.ts`
- `packages/payment-solana/src/exact/facilitator.ts`
- `scripts/solana-example/solana-exact-payment.ts`
- `scripts/solana-example/crossmint-payment.ts`
- `scripts/solana-example/squads-payment.ts`
- `scripts/solana-example/server-express.ts`

What the source says:

- Faremeter's facilitator app still mounts three Solana handlers in order:
  - `@faremeter/x-solana-settlement` for native SOL
  - `@faremeter/x-solana-settlement` for SPL/USDC
  - `@faremeter/payment-solana/exact` for native v2 exact
- Their example resource server advertises both `xSolanaSettlement(...)` and `x402Exact(...)` on the same route.
- Their example clients are intentionally split by wallet type:
  - local keypair wallet uses `@faremeter/payment-solana/exact`
  - Crossmint smart wallet uses `@faremeter/x-solana-settlement`
  - Squads smart wallet uses `@faremeter/x-solana-settlement`
- This means smart-wallet support is not treated as a generic extension of Coinbase exact in their examples. It is a separate payment path, even though the facilitator also has an exact settlement-account mode.

Important exact-path implementation details:

- `payment-solana/exact` decides between two modes:
  - `toSpec`: partially signed transfer-to-payee transaction
  - `settlementAccount`: client sends the transaction and returns `transactionSignature + settleSecretKey`
- That mode switch only happens when all of the following are true:
  - `enableSettlementAccounts` is enabled on the client handler
  - the requirement advertises `extra.features.xSettlementAccountSupported`
  - the wallet implements `sendTransaction`
- Local wallet adapters only expose `partiallySignTransaction`, so they stay on normal exact.
- Crossmint-style adapters expose `sendTransaction`, which is what activates settlement-account flow.

Important facilitator-side exact validation details:

- Faremeter exact verification is strict about transaction structure.
- `packages/payment-solana/src/exact/verify.ts` expects:
  - fee payer must equal `requirements.extra.feePayer`
  - instruction count must be between 3 and 5
  - instruction 0 must be compute-unit-limit
  - instruction 1 must be compute-unit-price
  - instruction 2 must be the token transfer
  - any trailing instructions must be Lighthouse instructions only
- This is a strong hint that Corbits/Faremeter Solana exact is not merely "any valid Coinbase SVM exact transaction".

Reframed conclusion:

- The production question is not "does Coinbase `@x402/svm` interoperate with Corbits?"
- The production question is "which Faremeter Solana payment path should AgentCash standardize on for the downstream wallets we actually care about?"
- Based on Faremeter's own examples, the likely answer is:
  - normal local wallets can use `payment-solana/exact`
  - smart-wallet clients like Crossmint and Squads should use `x-solana-settlement`

Practical implication for router work:

- Router-side server support can still advertise Solana exact-style acceptance.
- But client compatibility for `agentcash` and `lobster.cash` should be designed around Faremeter's own wallet-specific handlers, not around raw Coinbase `@x402/svm` payload generation.
- The live Corbits `Invalid transaction` result is therefore not surprising and should not be treated as evidence that the router architecture is wrong.

Definition of done for live validation:

- one route advertises both Base and Solana
- Base still settles successfully
- Solana settles successfully on mainnet
- no duplicate Solana offers are emitted by the router
- hosted or dedicated facilitator path is confirmed compatible with the real downstream wallet flow

## Bottom Line

The right shape is an additive multi-network x402 config that preserves the current Base-only shorthand and emits one dual-network 402 challenge.

The hardest engineering decision is no longer raw Solana protocol support. That is available in both Coinbase x402 and the live Corbits/Faremeter stack.

The remaining hard part is downstream wallet interoperability. The live Corbits deployment strongly suggests that the right Solana direction is one `exact`-based path with settlement-account support for smart-wallet clients, but that still needs confirmation against real `lobster.cash` and `agentcash` wallet payment attempts.

## Facilitator Routing Decisions

These points are now implemented in `agentcash-router` and backed by passing tests.

- The old top-level `facilitatorUrl` is treated as a legacy global fallback only.
- `x402` now supports additive per-network facilitator config:
  - `x402.facilitators.evm`
  - `x402.facilitators.solana`
  - `x402.facilitators.networks[caip2Network]`
- Resolution precedence is:
  - exact network override
  - chain-family override
  - legacy top-level `facilitatorUrl`
  - family default
- The family defaults are now:
  - EVM/Base: Coinbase/CDP facilitator
  - Solana: `https://facilitator.corbits.dev`
- Solana challenge enrichment is no longer route-global. The router only calls facilitator `/accepts` for the requirements that actually need enrichment, grouped by the facilitator assigned to that network.
- This prevents the previous incorrect behavior where one shared facilitator URL was implicitly used for both Base and Solana on the same paid route.
