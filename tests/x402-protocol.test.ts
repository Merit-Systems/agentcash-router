import { describe, expect, it } from 'vitest';
import { encodePaymentSignatureHeader } from '@x402/core/http';
import { verifyX402Payment } from '../src/protocols/x402/verify.js';
import { FakeX402Server, KNOWN_PAYEE, KNOWN_PAYER } from './fakes/x402-server.js';

const SOLANA_NETWORK = 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp';
const SOLANA_PAYEE = '9tCZP1W2jNYZjikmteU1HRrkoSGaRqcNs9ciLeQZb4a2';

function makeV2PaymentRequest(accepted: Record<string, unknown>): Request {
  return new Request('https://api.example.com/test', {
    method: 'POST',
    headers: {
      'PAYMENT-SIGNATURE': encodePaymentSignatureHeader({
        x402Version: 2,
        resource: { url: 'https://api.example.com/test', method: 'POST' },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        accepted: accepted as any,
        payload: { payer: KNOWN_PAYER },
      }),
    },
  });
}

describe('verifyX402Payment', () => {
  it('fails closed when a facilitator verifies without returning a payer', async () => {
    class MissingPayerServer extends FakeX402Server {
      async verifyPayment() {
        return { isValid: true };
      }
    }

    const request = new Request('https://api.example.com/test', {
      headers: {
        'PAYMENT-SIGNATURE': encodePaymentSignatureHeader({
          x402Version: 2,
          resource: { url: 'https://api.example.com/test', method: 'POST' },
          accepted: {
            scheme: 'exact',
            network: 'eip155:8453',
            amount: '0.02',
            asset: 'mock-usdc',
            payTo: KNOWN_PAYEE,
            maxTimeoutSeconds: 300,
          },
          payload: {},
        }),
      },
    });

    await expect(
      verifyX402Payment({
        server: new MissingPayerServer(),
        request,
        price: '0.02',
        accepts: [{ scheme: 'exact', network: 'eip155:8453', payTo: KNOWN_PAYEE }],
      }),
    ).rejects.toThrow('x402 verification succeeded without a payer address');
  });

  it('returns a structured failure for a malformed X-PAYMENT header instead of throwing', async () => {
    const request = new Request('https://api.example.com/test', {
      headers: { 'PAYMENT-SIGNATURE': 'bogus' },
    });

    const result = await verifyX402Payment({
      server: new FakeX402Server(),
      request,
      price: '0.02',
      accepts: [{ scheme: 'exact', network: 'eip155:8453', payTo: KNOWN_PAYEE }],
    });

    expect(result).toMatchObject({
      valid: false,
      failure: { reason: 'malformed_payment_header' },
    });
  });
});

describe('verifyX402Payment — settle requirements trust boundary', () => {
  it('uses the server-built requirement at settle, not the client-tampered accepted copy', async () => {
    // Client claims a 1-unit price and smuggles a tampered EIP-712 domain in
    // `extra`; the matched requirement handed to settle must carry the
    // server-built amount and extra instead.
    const request = makeV2PaymentRequest({
      scheme: 'exact',
      network: 'eip155:8453',
      amount: '1',
      asset: 'mock-usdc',
      payTo: KNOWN_PAYEE,
      maxTimeoutSeconds: 300,
      extra: { name: 'EvilToken', version: '666' },
    });

    const result = await verifyX402Payment({
      server: new FakeX402Server(),
      request,
      price: '0.02',
      accepts: [{ scheme: 'exact', network: 'eip155:8453', payTo: KNOWN_PAYEE }],
    });

    expect(result?.valid).toBe(true);
    expect(result?.requirements).toMatchObject({
      scheme: 'exact',
      network: 'eip155:8453',
      amount: '20000', // server-built atomic amount for $0.02, not the claimed '1'
      payTo: KNOWN_PAYEE,
    });
    expect(result?.requirements?.extra).not.toHaveProperty('name');
    expect(result?.requirements?.extra).not.toHaveProperty('version');
  });

  it('carries facilitator-enriched Solana extra fields from accepted into the matched requirement', async () => {
    const enrichedExtra = { feePayer: 'fee-payer-pubkey', recentBlockhash: 'recent-blockhash' };
    const request = makeV2PaymentRequest({
      scheme: 'exact',
      network: SOLANA_NETWORK,
      amount: '20000',
      asset: 'mock-usdc',
      payTo: SOLANA_PAYEE,
      maxTimeoutSeconds: 300,
      extra: enrichedExtra,
    });

    const result = await verifyX402Payment({
      server: new FakeX402Server(),
      request,
      price: '0.02',
      accepts: [{ scheme: 'exact', network: SOLANA_NETWORK, payTo: SOLANA_PAYEE }],
    });

    expect(result?.valid).toBe(true);
    // Stable fields come from the server-built requirement…
    expect(result?.requirements).toMatchObject({
      scheme: 'exact',
      network: SOLANA_NETWORK,
      amount: '20000',
      payTo: SOLANA_PAYEE,
    });
    // …while facilitator enrichment survives from `accepted`.
    expect(result?.requirements?.extra).toMatchObject(enrichedExtra);
  });
});
