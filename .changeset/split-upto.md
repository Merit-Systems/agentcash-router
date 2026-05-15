---
'@agentcash/router': minor
---

Split the `.upTo()` scheme into its own dynamic-invoke flow, separate from
`.metered()`. `withScopedKinds` now merges each facilitator kind's `extra`
(carrying `facilitatorAddress`) instead of replacing the kinds list, so
`.upTo()` routes are payable again while spurious networks stay filtered.

`DynamicPricing.quote()` rethrows `HttpError` instead of swallowing it into a
`maxPrice` charge, so a pricing function's pre-payment rejection returns its
intended non-2xx response rather than billing the caller the cap.

Mixing `.upTo()` and `.metered()` protocol configs on a route now throws at
build time. `OrchestrateDeps` is renamed to `RouterDeps`.
