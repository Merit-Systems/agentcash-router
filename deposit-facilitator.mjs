/**
 * Deposit to x402facilitator.dev to get a facilitator URL.
 * Uses direct @x402 payment from Craig's wallet.
 */
import { privateKeyToAccount } from 'viem/accounts';
import { readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

// Load Craig's wallet
const walletPath = join(homedir(), '.x402scan-mcp', 'wallet.json');
const wallet = JSON.parse(readFileSync(walletPath, 'utf-8'));
const account = privateKeyToAccount(wallet.privateKey);
console.log('Wallet:', account.address);

// Import x402 client
const { x402Client, x402HTTPClient } = await import('@x402/core/client');
const { ExactEvmScheme } = await import('@x402/evm/exact/client');

const coreClient = x402Client.fromConfig({
  schemes: [{ network: 'eip155:8453', client: new ExactEvmScheme(account) }],
});
const httpClient = new x402HTTPClient(coreClient);

// Step 1: Probe the deposit endpoint
const depositUrl = 'https://x402facilitator.dev/api/deposit?amount=2.5';
const depositBody = JSON.stringify({
  notificationEmail: 'craig@craig.x402email.com',
  walletAddress: account.address,
});

console.log('Probing deposit endpoint...');
const probeRes = await fetch(depositUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: depositBody,
});

console.log('Probe status:', probeRes.status);

if (probeRes.status !== 402) {
  console.log('Unexpected status:', await probeRes.text());
  process.exit(1);
}

// Step 2: Parse payment requirements
const paymentRequired = await httpClient.getPaymentRequiredResponse(
  name => probeRes.headers.get(name),
  await probeRes.json().catch(() => undefined),
);
console.log('Payment required:', JSON.stringify(paymentRequired, null, 2).slice(0, 500));

// Step 3: Create payment payload (sign)
console.log('Signing payment...');
const paymentPayload = await httpClient.createPaymentPayload(paymentRequired);
console.log('Payment signed');

// Step 4: Encode headers and retry
const paymentHeaders = httpClient.encodePaymentSignatureHeader(paymentPayload);
console.log('Payment headers:', Object.keys(paymentHeaders));

const paidRes = await fetch(depositUrl, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    ...paymentHeaders,
  },
  body: depositBody,
});

console.log('Paid response status:', paidRes.status);
const result = await paidRes.text();
console.log('Result:', result);
