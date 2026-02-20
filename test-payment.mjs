/**
 * Full x402 payment test against local fortune server.
 * Tests the exact same signing path that Poncho/agentcash uses.
 */
import { privateKeyToAccount } from 'viem/accounts';
import { readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const wallet = JSON.parse(readFileSync(join(homedir(), '.x402scan-mcp', 'wallet.json'), 'utf-8'));
const account = privateKeyToAccount(wallet.privateKey);
console.log('Wallet:', account.address);

const { x402Client, x402HTTPClient } = await import('@x402/core/client');
const { ExactEvmScheme } = await import('@x402/evm/exact/client');

const coreClient = x402Client.fromConfig({
  schemes: [{ network: 'eip155:8453', client: new ExactEvmScheme(account) }],
});
const httpClient = new x402HTTPClient(coreClient);

const url = process.env.FORTUNE_URL || 'http://127.0.0.1:3001/fortune';

// Step 1: Probe
console.log('\n=== Step 1: Probe ===');
const t0 = Date.now();
const probeRes = await fetch(url, { method: 'POST' });
console.log(`Status: ${probeRes.status} (${Date.now()-t0}ms)`);
console.log('PAYMENT-REQUIRED header present:', !!probeRes.headers.get('payment-required'));

if (probeRes.status !== 402) {
  console.log('Body:', await probeRes.text());
  process.exit(1);
}

// Step 2: Parse payment requirements
console.log('\n=== Step 2: Parse requirements ===');
const t1 = Date.now();
const paymentRequired = await httpClient.getPaymentRequiredResponse(
  name => probeRes.headers.get(name),
  await probeRes.json().catch(() => undefined),
);
console.log(`Parsed in ${Date.now()-t1}ms`);
console.log('Scheme:', paymentRequired.accepts[0]?.scheme);
console.log('Network:', paymentRequired.accepts[0]?.network);
console.log('Amount:', paymentRequired.accepts[0]?.amount);
console.log('Asset:', paymentRequired.accepts[0]?.asset);
console.log('Extra:', JSON.stringify(paymentRequired.accepts[0]?.extra));

// Step 3: Sign payment
console.log('\n=== Step 3: Sign payment ===');
const t2 = Date.now();
try {
  const paymentPayload = await httpClient.createPaymentPayload(paymentRequired);
  const signTime = Date.now()-t2;
  console.log(`Signed in ${signTime}ms`);
  console.log('Payload x402Version:', paymentPayload.x402Version);
  console.log('Payload has signature:', !!paymentPayload.payload?.signature);
  
  // Step 4: Encode and send
  console.log('\n=== Step 4: Send paid request ===');
  const t3 = Date.now();
  const paymentHeaders = httpClient.encodePaymentSignatureHeader(paymentPayload);
  
  const paidRes = await fetch(url, {
    method: 'POST',
    headers: paymentHeaders,
  });
  
  console.log(`Status: ${paidRes.status} (${Date.now()-t3}ms)`);
  const body = await paidRes.text();
  console.log('Body:', body);
  
  if (paidRes.status === 200) {
    console.log('\n✅ Full payment flow succeeded!');
  } else {
    console.log('\n❌ Payment accepted but response not 200');
  }
  
} catch (err) {
  console.error(`\n❌ Signing failed after ${Date.now()-t2}ms`);
  console.error('Error:', err.message);
  console.error('Stack:', err.stack);
}
