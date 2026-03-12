import { createRequire } from 'node:module';
import { Keypair, PublicKey, Connection, clusterApiUrl } from '@solana/web3.js';
import { wrap as wrapFetch, WrappedFetchError } from '@faremeter/fetch';
import { lookupKnownSPLToken } from '@faremeter/info/solana';
import { createPaymentHandler as createExactPaymentHandler } from '@faremeter/payment-solana/exact';
import { createLocalWallet } from '@faremeter/wallet-solana';
import { decodePaymentRequiredHeader, decodePaymentResponseHeader } from '@x402/core/http';

const require = createRequire(import.meta.url);
const { NextRequest } = require('next/server');
const { createRouter } = require('../dist/index.cjs');

const URL = 'http://localhost:3000/live-faremeter-exact';
const METHOD = 'GET';
const PRICE = '0.001';
const BASE_NETWORK = 'eip155:8453';
const SOLANA_NETWORK = 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp';
const SETTLEMENT_SCHEME = '@faremeter/x-solana-settlement';
const FALLBACK_BASE_PAYEE = '0x1111111111111111111111111111111111111111';

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function parseJsonMaybe(value) {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function makeRouterFetch(handler) {
  return async (input, init = {}) => {
    const request = input instanceof Request ? input : new Request(input, init);
    const nextRequest = new NextRequest(request.url, {
      method: request.method,
      headers: request.headers,
      body: request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.text(),
    });
    return handler(nextRequest);
  };
}

async function createExactFetch(handler, mintAddress) {
  const clientSecret = requireEnv('SOLANA_TEST_CLIENT_SECRET_KEY_BASE64');
  const keypair = Keypair.fromSecretKey(
    Uint8Array.from(Buffer.from(clientSecret, 'base64')),
  );
  const wallet = await createLocalWallet('mainnet-beta', keypair);
  const rpcUrl = process.env.SOLANA_RPC_URL || clusterApiUrl('mainnet-beta');
  const connection = new Connection(rpcUrl, 'confirmed');

  return wrapFetch(makeRouterFetch(handler), {
    handlers: [createExactPaymentHandler(wallet, new PublicKey(mintAddress), connection)],
  });
}

async function main() {
  const facilitatorUrl = requireEnv('CORBITS_FACILITATOR_URL');
  const solanaPayee = requireEnv('SOLANA_TEST_MERCHANT_PUBLIC_KEY');
  const basePayee = process.env.BASE_TEST_PAYEE_ADDRESS || FALLBACK_BASE_PAYEE;
  const usdcInfo = lookupKnownSPLToken('mainnet-beta', 'USDC');

  if (!usdcInfo) {
    throw new Error('Unable to resolve Solana mainnet USDC mint');
  }

  const router = createRouter({
    baseUrl: 'http://localhost:3000',
    facilitatorUrl,
    strictRoutes: true,
    x402: {
      accepts: [
        { network: BASE_NETWORK, payTo: basePayee },
        { network: SOLANA_NETWORK, payTo: solanaPayee },
        {
          scheme: SETTLEMENT_SCHEME,
          network: SOLANA_NETWORK,
          payTo: solanaPayee,
          asset: usdcInfo.address,
          decimals: 6,
          maxTimeoutSeconds: 60,
        },
      ],
    },
  });

  const handler = router
    .route({ path: 'live-faremeter-exact', method: METHOD })
    .paid(PRICE)
    .handler(async () => ({
      ok: true,
      price: PRICE,
      source: 'live-faremeter-exact',
    }));

  const probeResponse = await handler(new NextRequest(URL, { method: METHOD }));
  const probeBody = await probeResponse.text();

  assert(
    probeResponse.status === 402,
    `Expected unpaid probe to return 402, got ${probeResponse.status}: ${probeBody}`,
  );

  const challengeHeader = probeResponse.headers.get('PAYMENT-REQUIRED');
  assert(challengeHeader, `Probe response did not include PAYMENT-REQUIRED: ${probeBody}`);

  const challenge = decodePaymentRequiredHeader(challengeHeader);
  const solanaExactRequirement = challenge.accepts.find(
    (accept) => accept.scheme === 'exact' && accept.network === SOLANA_NETWORK,
  );

  assert(
    solanaExactRequirement,
    `Solana exact requirement was not advertised: ${JSON.stringify(challenge.accepts, null, 2)}`,
  );

  console.log(
    JSON.stringify(
      {
        step: 'challenge',
        accepts: challenge.accepts.map((accept) => ({
          scheme: accept.scheme,
          network: accept.network,
          asset: accept.asset,
          amount: accept.amount,
          payTo: accept.payTo,
          extra: accept.extra,
        })),
      },
      null,
      2,
    ),
  );

  const paidFetch = await createExactFetch(handler, usdcInfo.address);

  let paidResponse;
  try {
    paidResponse = await paidFetch(URL, { method: METHOD });
  } catch (error) {
    if (error instanceof WrappedFetchError) {
      const bodyText = await error.response.text();
      throw new Error(
        JSON.stringify(
          {
            status: error.response.status,
            headers: Object.fromEntries(error.response.headers.entries()),
            body: parseJsonMaybe(bodyText),
          },
          null,
          2,
        ),
      );
    }
    throw error;
  }

  const paidBodyText = await paidResponse.text();
  assert(
    paidResponse.ok,
    `Expected exact fetch to succeed, got ${paidResponse.status}: ${paidBodyText}`,
  );

  const paymentResponseHeader = paidResponse.headers.get('PAYMENT-RESPONSE');
  assert(
    paymentResponseHeader,
    `Paid response did not include PAYMENT-RESPONSE: ${paidBodyText}`,
  );

  const paymentResponse = decodePaymentResponseHeader(paymentResponseHeader);

  console.log(
    JSON.stringify(
      {
        step: 'settlement',
        status: paidResponse.status,
        network: paymentResponse.network,
        transaction: paymentResponse.transaction,
        payer: paymentResponse.payer,
        body: parseJsonMaybe(paidBodyText),
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        step: 'error',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      null,
      2,
    ),
  );
  process.exit(1);
});
