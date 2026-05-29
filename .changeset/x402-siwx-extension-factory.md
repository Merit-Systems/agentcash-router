---
"@agentcash/router": patch
---

Migrate to the `createSIWxResourceServerExtension({ storage })` factory from `@x402/extensions@2.13.0` and require `@x402/* ^2.13.0`.

`@x402/extensions@2.13.0` replaced the `siwxResourceServerExtension` value export with a `createSIWxResourceServerExtension({ storage })` factory. The router still destructured the old name, so fresh installs that resolved 2.13 crashed at boot with `TypeError: Cannot read properties of undefined (reading 'key')` inside `x402ResourceServer.registerExtension` — surfaced to handlers as the opaque `Payment protocol initialization failed. x402: Cannot read properties of undefined (reading 'key')`.

The router only relies on the extension's `enrichPaymentRequiredResponse` hook (which refreshes the SIWX challenge — nonce, issuedAt, domain, supportedChains — on the paid+SIWX challenge path); that hook is unchanged in the factory. The factory's additional `onAfterSettle`/`onProtectedRequest` hooks never fire here, because the router settles via the low-level resource server with `declaredExtensions` unset and never uses the HTTP transport layer. Entitlement and nonce replay remain owned by the router's own pipeline, so the `storage` argument is satisfied with an inert `InMemorySIWxStorage`.

- `@x402/core: ^2.11.0` → `^2.13.0`
- `@x402/evm: ^2.11.0` → `^2.13.0`
- `@x402/extensions: ^2.11.0` → `^2.13.0`
- `@x402/svm: ^2.11.0` → `^2.13.0`
