import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { PublicKey } from '@solana/web3.js';
import {
  parseConfig,
  withAuthenticatedApi,
  getKeypair,
  getWalletBalance,
  ProxyApiError,
} from '@crossmint/lobster-cli';
import { wrap as wrapFetch, WrappedFetchError } from '@faremeter/fetch';
import { lookupKnownSPLToken } from '@faremeter/info/solana';
import { createPaymentHandler as createExactPaymentHandler } from '@faremeter/payment-solana/exact';
import { decodePaymentRequiredHeader, decodePaymentResponseHeader } from '@x402/core/http';

const require = createRequire(import.meta.url);
const { NextRequest } = require('next/server');
const { createRouter } = require('../dist/index.cjs');

const cwd = process.cwd();
process.env.LOBSTER_CASH_WALLETS_DIR ||= path.join(cwd, '.lobster');

const URL = 'http://localhost:3000/live-lobster-exact';
const METHOD = 'GET';
const PRICE = '0.001';
const BASE_NETWORK = 'eip155:8453';
const SOLANA_NETWORK = 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp';
const FALLBACK_BASE_PAYEE = '0x1111111111111111111111111111111111111111';
const DEFAULT_MIN_USDC = 1;
const DEFAULT_MIN_SOL = 0.005;

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

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getBalanceAmount(balances, token) {
  const match = balances.find((balance) => balance.token.toLowerCase() === token);
  return toNumber(match?.amount);
}

function getMinimumBalance(envName, fallback) {
  const raw = process.env[envName];
  return raw ? toNumber(raw) : fallback;
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

async function loadLobsterX402WalletAdapter() {
  const moduleUrl = pathToFileURL(
    path.join(cwd, 'node_modules', '@crossmint', 'lobster-cli', 'dist', 'core', 'x402-wallet-adapter.js'),
  ).href;
  return import(moduleUrl);
}

async function main() {
  const facilitatorUrl = requireEnv('CORBITS_FACILITATOR_URL');
  const solanaPayee = requireEnv('SOLANA_TEST_MERCHANT_PUBLIC_KEY');
  const basePayee = process.env.BASE_TEST_PAYEE_ADDRESS || FALLBACK_BASE_PAYEE;
  const agentId = process.env.LOBSTER_AGENT_ID || 'router-live';
  const minimumUsdc = getMinimumBalance('LOBSTER_MIN_USDC', DEFAULT_MIN_USDC);
  const minimumSol = getMinimumBalance('LOBSTER_MIN_SOL', DEFAULT_MIN_SOL);
  const config = parseConfig({
    serverBaseUrl: process.env.LOBSTER_SERVER_BASE_URL || 'https://www.lobster.cash',
    requestTimeoutMs: process.env.LOBSTER_REQUEST_TIMEOUT_MS
      ? Number(process.env.LOBSTER_REQUEST_TIMEOUT_MS)
      : 15000,
  });
  const usdcInfo = lookupKnownSPLToken('mainnet-beta', 'USDC');
  if (!usdcInfo) {
    throw new Error('Unable to resolve Solana mainnet USDC mint');
  }

  await withAuthenticatedApi(agentId, config, async ({ walletData, apiConfig }) => {
    const agentKeypair = getKeypair(agentId);
    if (!agentKeypair) {
      throw new Error(`No Lobster keypair found for agent '${agentId}'`);
    }

    const balances = await getWalletBalance(apiConfig, walletData.walletAddress);
    const usdcBalance = getBalanceAmount(balances, 'usdc');
    const solBalance = getBalanceAmount(balances, 'sol');

    console.log(
      JSON.stringify(
        {
          step: 'wallet',
          agentId,
          smartWalletAddress: walletData.walletAddress,
          balances,
        },
        null,
        2,
      ),
    );

    if (usdcBalance < minimumUsdc || solBalance < minimumSol) {
      throw new Error(
        `Lobster wallet underfunded for live exact test. ` +
          `Observed balances: ${usdcBalance} USDC, ${solBalance} SOL. ` +
          `Required minimums: ${minimumUsdc} USDC, ${minimumSol} SOL.`,
      );
    }

    const { createX402WalletAdapter } = await loadLobsterX402WalletAdapter();
    const lobsterWallet = createX402WalletAdapter({
      apiConfig,
      walletAddress: walletData.walletAddress,
      agentKeypair,
      network: 'mainnet-beta',
    });

    const router = createRouter({
      baseUrl: 'http://localhost:3000',
      strictRoutes: true,
      x402: {
        facilitators: {
          solana: facilitatorUrl,
        },
        accepts: [
          { network: BASE_NETWORK, payTo: basePayee },
          { network: SOLANA_NETWORK, payTo: solanaPayee },
        ],
      },
    });

    const handler = router
      .route({ path: 'live-lobster-exact', method: METHOD })
      .paid(PRICE)
      .handler(async () => ({
        ok: true,
        price: PRICE,
        source: 'live-lobster-exact',
        walletAddress: walletData.walletAddress,
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

    console.log(
      JSON.stringify(
        {
          step: 'challenge',
          agentId,
          smartWalletAddress: walletData.walletAddress,
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

    const paidFetch = wrapFetch(makeRouterFetch(handler), {
      handlers: [
        createExactPaymentHandler(lobsterWallet, new PublicKey(usdcInfo.address), undefined, {
          token: {
            allowOwnerOffCurve: true,
          },
          settlementRentDestination: walletData.walletAddress,
          features: { enableSettlementAccounts: true },
        }),
      ],
    });

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
      if (error instanceof ProxyApiError) {
        throw new Error(
          JSON.stringify(
            {
              name: error.name,
              message: error.message,
              status: error.status,
              code: error.code,
              details: error.details,
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
      `Expected Lobster exact fetch to succeed, got ${paidResponse.status}: ${paidBodyText}`,
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
          agentId,
          smartWalletAddress: walletData.walletAddress,
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
  });
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
