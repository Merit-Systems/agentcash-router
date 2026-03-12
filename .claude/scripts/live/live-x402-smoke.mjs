import { createRequire } from 'node:module';
import { createKeyPairSignerFromBytes } from '@solana/kit';
import { x402Client } from '@x402/core/client';
import {
  decodePaymentRequiredHeader,
  decodePaymentResponseHeader,
  encodePaymentSignatureHeader,
} from '@x402/core/http';
import { ExactSvmScheme, SOLANA_MAINNET_CAIP2 } from '@x402/svm';

const require = createRequire(import.meta.url);
const { NextRequest } = require('next/server');
const { createRouter } = require('../dist/index.cjs');

const URL = 'http://localhost:3000/live-x402-smoke';
const METHOD = 'POST';
const PRICE = '0.001';
const BASE_NETWORK = 'eip155:8453';
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

function makeRequest(headers = {}) {
  return new NextRequest(URL, {
    method: METHOD,
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
    body: JSON.stringify({ probe: 'live-x402-smoke' }),
  });
}

async function createSolanaPaymentClient() {
  const clientSecret = requireEnv('SOLANA_TEST_CLIENT_SECRET_KEY_BASE64');
  const secretKeyBytes = Uint8Array.from(Buffer.from(clientSecret, 'base64'));
  const signer = await createKeyPairSignerFromBytes(secretKeyBytes);
  const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';

  return new x402Client((_, accepts) => {
    const selected = accepts.find((accept) => accept.network === SOLANA_MAINNET_CAIP2);
    if (!selected) {
      throw new Error('Solana mainnet requirement was not advertised in the 402 challenge');
    }
    return selected;
  }).register(SOLANA_MAINNET_CAIP2, new ExactSvmScheme(signer, { rpcUrl }));
}

async function main() {
  const facilitatorUrl = requireEnv('CORBITS_FACILITATOR_URL');
  const solanaPayee = requireEnv('SOLANA_TEST_MERCHANT_PUBLIC_KEY');
  const basePayee = process.env.BASE_TEST_PAYEE_ADDRESS || FALLBACK_BASE_PAYEE;

  const router = createRouter({
    baseUrl: 'http://localhost:3000',
    strictRoutes: true,
    x402: {
      facilitators: {
        solana: facilitatorUrl,
      },
      accepts: [
        { network: BASE_NETWORK, payTo: basePayee },
        { network: SOLANA_MAINNET_CAIP2, payTo: solanaPayee },
      ],
    },
  });

  const handler = router
    .route({ path: 'live-x402-smoke', method: METHOD })
    .paid(PRICE)
    .handler(async () => ({
      ok: true,
      price: PRICE,
      network: 'solana',
      source: 'live-x402-smoke',
    }));

  const probeResponse = await handler(makeRequest());
  const probeBody = await probeResponse.text();

  assert(
    probeResponse.status === 402,
    `Expected unpaid probe to return 402, got ${probeResponse.status}: ${probeBody}`,
  );

  const challengeHeader = probeResponse.headers.get('PAYMENT-REQUIRED');
  assert(challengeHeader, `Probe response did not include PAYMENT-REQUIRED: ${probeBody}`);

  const challenge = decodePaymentRequiredHeader(challengeHeader);
  const advertisedNetworks = challenge.accepts.map((accept) => accept.network);
  const solanaRequirement = challenge.accepts.find(
    (accept) => accept.network === SOLANA_MAINNET_CAIP2,
  );

  assert(
    advertisedNetworks.includes(BASE_NETWORK),
    `Base network ${BASE_NETWORK} was not advertised: ${JSON.stringify(advertisedNetworks)}`,
  );
  assert(
    solanaRequirement,
    `Solana network ${SOLANA_MAINNET_CAIP2} was not advertised: ${JSON.stringify(advertisedNetworks)}`,
  );

  console.log(
    JSON.stringify(
      {
        step: 'challenge',
        advertisedNetworks,
        solanaPayTo: solanaRequirement.payTo,
        solanaAmount: solanaRequirement.amount,
        facilitatorUrl,
      },
      null,
      2,
    ),
  );

  const paymentClient = await createSolanaPaymentClient();
  const paymentPayload = await paymentClient.createPaymentPayload(challenge);
  const paymentHeader = encodePaymentSignatureHeader(paymentPayload);

  const paidResponse = await handler(
    makeRequest({
      'PAYMENT-SIGNATURE': paymentHeader,
    }),
  );
  const paidBodyText = await paidResponse.text();

  if (!paidResponse.ok) {
    const retryChallengeHeader = paidResponse.headers.get('PAYMENT-REQUIRED');
    const retryChallenge = retryChallengeHeader
      ? decodePaymentRequiredHeader(retryChallengeHeader)
      : null;

    throw new Error(
      JSON.stringify(
        {
          status: paidResponse.status,
          headers: Object.fromEntries(paidResponse.headers.entries()),
          body: parseJsonMaybe(paidBodyText),
          retryChallenge,
        },
        null,
        2,
      ),
    );
  }

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
