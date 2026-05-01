/**
 * Single source of truth for the HTTP header names and Authorization scheme
 * prefixes the router reads from requests and writes to responses.
 *
 * x402 and MPP each define a small set of headers; SIWX adds one more. All
 * other code should reference these constants rather than re-typing the
 * literal — drift between callsites is the most common cause of "header
 * is missing" bugs in payment plumbing.
 */

export const HEADERS = {
  // ---- Standard HTTP ----
  AUTHORIZATION: 'Authorization',
  WWW_AUTHENTICATE: 'WWW-Authenticate',

  // ---- Auth ----
  API_KEY: 'X-API-Key',

  // ---- Request meta (used by plugin/observability) ----
  WALLET_ADDRESS: 'X-Wallet-Address',
  CLIENT_ID: 'X-Client-ID',
  SESSION_ID: 'X-Session-ID',

  // ---- SIWX ----
  SIWX: 'SIGN-IN-WITH-X',

  // ---- x402 (payment) ----
  X402_PAYMENT_SIGNATURE: 'PAYMENT-SIGNATURE',
  /** Legacy x402 payment header — accepted alongside PAYMENT-SIGNATURE. */
  X402_PAYMENT_LEGACY: 'X-PAYMENT',
  X402_PAYMENT_REQUIRED: 'PAYMENT-REQUIRED',
  X402_PAYMENT_RESPONSE: 'PAYMENT-RESPONSE',

  // ---- MPP (payment) ----
  MPP_PAYMENT_RECEIPT: 'Payment-Receipt',
} as const;

/**
 * Authorization-header scheme prefixes. The full header value looks like
 * `<scheme><credential>`, e.g. `Bearer abc123` or `Payment <base64>`.
 */
export const AUTH_SCHEME = {
  BEARER: 'Bearer ',
  MPP_PAYMENT: 'Payment ',
} as const;
