import { describe, expect, it } from 'vitest';
import { encodePaymentSignatureHeader } from '@x402/core/http';
import { verifyX402Payment } from '../src/protocols/x402/verify.js';
import { FakeX402Server, KNOWN_PAYEE } from './fakes/x402-server.js';

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
});
