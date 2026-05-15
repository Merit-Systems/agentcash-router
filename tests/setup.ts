// EVM x402 routers require Coinbase CDP facilitator credentials, which the
// router validates at construction. Tests that don't exercise credential
// validation assume a configured environment; tests that do set or clear
// CDP_API_KEY_ID / CDP_API_KEY_SECRET explicitly.
process.env.CDP_API_KEY_ID ??= 'test-cdp-key-id';
process.env.CDP_API_KEY_SECRET ??= 'test-cdp-key-secret';
