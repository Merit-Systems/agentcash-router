export const HEADERS = {
  AUTHORIZATION: 'Authorization',
  WWW_AUTHENTICATE: 'WWW-Authenticate',
  API_KEY: 'X-API-Key',
  WALLET_ADDRESS: 'X-Wallet-Address',
  CLIENT_ID: 'X-Client-ID',
  SESSION_ID: 'X-Session-ID',
  SIWX: 'SIGN-IN-WITH-X',
  X402_PAYMENT_SIGNATURE: 'PAYMENT-SIGNATURE',
  X402_PAYMENT_LEGACY: 'X-PAYMENT',
  X402_PAYMENT_REQUIRED: 'PAYMENT-REQUIRED',
  X402_PAYMENT_RESPONSE: 'PAYMENT-RESPONSE',
  MPP_PAYMENT_RECEIPT: 'Payment-Receipt',
  REQUEST_ID: 'X-Request-ID',
  AGENT_IDENTITY: 'X-Agent-Identity',
} as const;

export const AUTH_SCHEME = {
  BEARER: 'Bearer ',
  MPP_PAYMENT: 'Payment ',
} as const;
