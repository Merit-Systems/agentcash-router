# Changelog

All notable changes to `@agentcash/router` will be documented in this file.

## [0.5.0] - 2026-02-16

### Added
- **Wallet normalization**: All wallet addresses normalized to lowercase on `ctx.wallet` (checksumming is display concern)
- **SIWX error codes**: Structured error responses with `code` field for client auto-retry (`siwx_expired`, `siwx_nonce_used`, `siwx_invalid_signature`, `siwx_malformed`)
- **`SIWX_CHALLENGE_EXPIRY_MS` export**: Configurable challenge expiry (default 5 minutes)
- **MPP payment flow tests**: Full test coverage mirroring x402 (probe, valid/invalid credential, handler error, wallet context)
- **`.validate()` builder method**: Pre-payment validation hook that runs before 402 challenge

### Changed
- SIWX verification returns error codes instead of generic failure

## [0.4.1] - 2026-02-15

### Fixed
- **MPP body consumption bug**: Remove body from `toStandardRequest()` since MPP only needs Authorization header (body already consumed by `parseBody()`)

## [0.4.0] - 2026-02-14

### Added
- **MPP (Tempo) payment support**: Full integration with mpay library for Tempo network payments
- **`mppConfig` in router options**: Configure MPP with `secretKey`, `currency`, `recipient`, optional `rpcUrl`
- **`WWW-Authenticate` header**: MPP challenges use standard HTTP auth header
- **`Payment-Receipt` header**: MPP receipts attached on successful payment

### Changed
- Protocol detection extended to recognize `Authorization: Payment` header for MPP

## [0.3.1] - 2026-02-13

### Fixed
- **Dynamic pricing bug**: Pricing function now called before 402 challenge (was using `maxPrice` for all requests)
- Early body parsing with `request.clone()` enables accurate dynamic pricing

### Changed
- `maxPrice` is now optional (acts as safety net / fallback, not required)

## [0.3.0] - 2026-02-12

### Added
- **`protocols` config field**: Explicit protocol selection per route (`['x402']`, `['mpp']`, `['x402', 'mpp']`)
- **Protocol-specific challenge headers**: x402 uses `PAYMENT-REQUIRED`, MPP uses `WWW-Authenticate`

## [0.2.1] - 2026-02-10

### Fixed
- Error `.status` fallback: Respect status on any thrown error, not just `HttpError`
- SIWX challenge format: Proper x402v2 structure with extensions
- Well-known visibility: `authMode !== 'unprotected'` determines discovery

## [0.2.0] - 2026-02-08

### Added
- **Route builder API**: Fluent `.paid()`, `.siwx()`, `.apiKey()`, `.unprotected()` methods
- **Plugin system**: `RouterPlugin` interface with lifecycle hooks
- **Discovery endpoints**: `/.well-known/x402` and `/openapi.json` auto-generation
- **Tiered pricing**: `{ field, tiers, default }` pricing structure

## [0.1.0] - 2026-02-05

### Added
- Initial release
- x402 payment protocol support
- Basic route registration and handler invocation
- Zod schema validation for request bodies
