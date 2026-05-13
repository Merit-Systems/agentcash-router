/**
 * End-to-end smoke test for the router's x402 `exact` + `upto` payment paths.
 *
 * The companion test (`test-session-alignment.ts`) exercises the MPP session
 * leg of the same routes. This file drives the x402 leg, with two goals:
 *
 *   1. Static-priced route via `exact` scheme — `/api/fortune/premium` is
 *      priced at $0.005 (from `prices` in `lib/router.ts`). Routes without
 *      `dynamic: true` advertise `scheme: 'exact'` in the 402 challenge.
 *   2. Dynamic-priced route via `upto` scheme — `/api/fortune/llm` is
 *      `.paid({ dynamic: true, tickCost: '0.001', maxPrice: '0.01' })`. This
 *      is the SAME route the MPP session test hits, by design: the router
 *      advertises both `scheme: 'upto'` (x402) AND `intent: 'session'`
 *      (MPP) in the same 402 challenge, and the client picks one. Here we
 *      pick `upto` and confirm the route settles per-request for `tickCost`
 *      (≤ maxPrice, enforced on-chain by Permit2Proxy).
 *
 * The contrast against the session test:
 *   - MPP sessions open one channel and reuse it across requests; the
 *     channel persists, vouchers cycle off-chain, on-chain settle is at
 *     close-time only.
 *   - x402 `upto` is one fresh Permit2 authorization per request; each
 *     request shows a new payload signature, and the facilitator settles
 *     on chain (or rejects without funds / Permit2 allowance).
 *
 * Run with (from repo root):
 *   pnpm tsx tests/integration/test-x402-exact-upto.ts
 *
 * Requires the fortune example's dev server running at http://localhost:3000
 * (cd examples/fortune && pnpm dev) with the same CDP / facilitator env it
 * normally needs. On-chain settlement will only succeed if CLIENT_PRIVATE_KEY
 * is a USDC-funded Base wallet with Permit2 approval already set; without
 * that, expect the request flow to reach settlement and report whatever the
 * facilitator returned.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { createPublicClient, createWalletClient, http, formatUnits } from 'viem';
import { base } from 'viem/chains';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import { x402Client, x402HTTPClient } from '@x402/core/client';
import { registerExactEvmScheme } from '@x402/evm/exact/client';
import {
  UptoEvmScheme,
  createPermit2ApprovalTx,
  erc20AllowanceAbi,
} from '@x402/evm/upto/client';
import { decodePaymentRequiredHeader, decodePaymentResponseHeader } from '@x402/core/http';

// tsx doesn't auto-load .env.local the way `next dev` does. Read it ourselves
// so CLIENT_PRIVATE_KEY, BASE_RPC_URL, etc. work without externally exporting.
function loadEnvFile(filePath: string): void {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, 'utf-8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}
loadEnvFile(path.resolve(process.cwd(), '.env.local'));

// `next dev` listens on 3000 by default; BASE_URL in .env.local controls the
// router's challenge realm/discovery URL but not the actual listening port.
const BASE_URL = process.env.TEST_BASE_URL ?? 'http://localhost:3000';
const BASE_NETWORK = 'eip155:8453';
const BASE_RPC_URL = process.env.BASE_RPC_URL ?? 'https://mainnet.base.org';

// USDC on Base mainnet. The router's accepts also point at this address.
const USDC_BASE: `0x${string}` = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
// Canonical Permit2 singleton — same on every EVM chain via CREATE2. The
// `upto` scheme requires the wallet to have approved this address to spend
// USDC. One approval per token, per wallet, forever.
const PERMIT2_ADDRESS: `0x${string}` = '0x000000000022D473030F116dDEE9F6B43aC78BA3';
// Minimum USDC allowance we need before running the upto tests. Tests 2+3
// settle at $0.001 each, so $0.10 is generous. Set to MaxUint256 by default
// when approving so we never have to re-approve.
const MIN_ALLOWANCE = 100_000n; // $0.10 in 6-decimal USDC

// Use CLIENT_PRIVATE_KEY from env when available so the operator can run with
// a funded Base mainnet wallet. Falls back to a random throwaway key for
// pure protocol smoke-testing (on-chain settle will fail, but we'll see the
// full client→challenge→payload→retry handshake up to that point).
const CLIENT_KEY = (process.env.CLIENT_PRIVATE_KEY as `0x${string}` | undefined) ?? generatePrivateKey();
const clientAccount = privateKeyToAccount(CLIENT_KEY);

const banner = (s: string) => `\n${'='.repeat(72)}\n${s}\n${'='.repeat(72)}`;
const sub = (s: string) => `\n--- ${s} ---`;

// One x402HTTPClient covers both schemes — the selector inside picks per
// challenge based on which `accepts` entry has a registered local scheme.
function buildHttpClient() {
  const core = new x402Client();
  // EVM `exact` registers via the helper — covers both v2 (eip155:*) and v1.
  registerExactEvmScheme(core, { signer: clientAccount, networks: [BASE_NETWORK] });
  // EVM `upto` has no register helper (yet); register the scheme directly.
  core.register(BASE_NETWORK, new UptoEvmScheme(clientAccount));
  return new x402HTTPClient(core);
}

async function probe(path: string, body?: unknown): Promise<Response> {
  return fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function describeChallenge(label: string, response: Response): void {
  console.log(sub(`Challenge: ${label}`));
  console.log(`  status:           ${response.status}`);
  console.log(`  content-type:     ${response.headers.get('Content-Type')}`);
  const required = response.headers.get('PAYMENT-REQUIRED');
  if (!required) {
    const wwwAuth = response.headers.get('WWW-Authenticate');
    console.log(`  PAYMENT-REQUIRED: (none)`);
    console.log(
      `  WWW-Authenticate: ${wwwAuth?.slice(0, 220) ?? '(none)'}${(wwwAuth?.length ?? 0) > 220 ? '...' : ''}`,
    );
    return;
  }
  try {
    const challenge = decodePaymentRequiredHeader(required);
    console.log(`  x402Version:      ${challenge.x402Version}`);
    console.log(`  accepts:          (${challenge.accepts.length} variants)`);
    for (const accept of challenge.accepts) {
      const a = accept as Record<string, unknown>;
      const intent = a.intent ? ` intent=${a.intent}` : '';
      const amount = a.amount ? ` amount=${a.amount}` : '';
      const asset = a.asset ? ` asset=${String(a.asset).slice(0, 12)}...` : '';
      console.log(`    - scheme=${a.scheme} network=${a.network}${intent}${amount}${asset}`);
    }
    const ext = (challenge as unknown as { extensions?: Record<string, unknown> }).extensions;
    if (ext && Object.keys(ext).length > 0) {
      console.log(`  extensions:       ${Object.keys(ext).join(', ')}`);
    }
  } catch (err) {
    console.log(`  PAYMENT-REQUIRED: (failed to decode: ${(err as Error).message})`);
  }
}

/**
 * Probe → create payload → retry with PAYMENT-SIGNATURE. Returns the second
 * response and a brief receipt summary (or whatever the facilitator returned).
 *
 * `preferScheme` constrains scheme selection — the client's default picks the
 * first registered match, but for this test we want to deliberately exercise
 * `exact` on one route and `upto` on the other. We achieve that via a policy
 * that filters the accepts list before selection.
 */
async function payAndRetry(
  path: string,
  body: unknown,
  preferScheme: 'exact' | 'upto',
): Promise<Response> {
  // Per-call client lets us scope the scheme-preference policy locally.
  const core = new x402Client();
  registerExactEvmScheme(core, { signer: clientAccount, networks: [BASE_NETWORK] });
  core.register(BASE_NETWORK, new UptoEvmScheme(clientAccount));
  core.registerPolicy((_, reqs) => reqs.filter((r) => r.scheme === preferScheme));
  const httpClient = new x402HTTPClient(core);

  const first = await probe(path, body);
  if (first.status !== 402) {
    console.log(`  UNEXPECTED first response: ${first.status}`);
    return first;
  }
  const required = first.headers.get('PAYMENT-REQUIRED');
  if (!required) {
    console.log('  Missing PAYMENT-REQUIRED header on 402 — cannot pay');
    return first;
  }

  const challenge = decodePaymentRequiredHeader(required);
  const payload = await httpClient.createPaymentPayload(challenge);
  const signatureHeaders = httpClient.encodePaymentSignatureHeader(payload);

  console.log(`  signed payload:   scheme=${(payload.accepted as { scheme: string }).scheme}`);
  console.log(
    `  signature bytes:  ${Object.values(signatureHeaders)[0]?.slice(0, 40)}... (${Object.keys(signatureHeaders).join(', ')})`,
  );

  return fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...signatureHeaders,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function describeSettleResponse(response: Response): void {
  console.log(`  status:           ${response.status}`);
  console.log(`  content-type:     ${response.headers.get('Content-Type')}`);
  const settleHeader = response.headers.get('PAYMENT-RESPONSE');
  if (settleHeader) {
    try {
      const settle = decodePaymentResponseHeader(settleHeader);
      const s = settle as Record<string, unknown>;
      console.log(`  settle.success:   ${s.success}`);
      console.log(`  settle.payer:     ${s.payer}`);
      console.log(`  settle.tx:        ${String(s.transaction ?? '').slice(0, 80)}`);
      if (s.errorReason) console.log(`  settle.error:     ${s.errorReason}`);
    } catch (err) {
      console.log(`  PAYMENT-RESPONSE: (failed to decode: ${(err as Error).message})`);
    }
  } else {
    console.log(`  PAYMENT-RESPONSE: (none)`);
  }
}

async function runExactStaticFlow(): Promise<void> {
  console.log(banner('Test 1 — Static `exact` scheme on /api/fortune/premium'));
  console.log(`Client wallet: ${clientAccount.address}`);
  console.log(
    `(${process.env.CLIENT_PRIVATE_KEY ? 'from CLIENT_PRIVATE_KEY env' : 'throwaway random key — settlement will fail on chain'})`,
  );

  // ── Probe first to see the raw 402 challenge before signing.
  const probeRes = await probe('/api/fortune/premium', { category: 'love' });
  describeChallenge('fortune/premium (static $0.005)', probeRes);

  if (probeRes.status !== 402) {
    console.log('UNEXPECTED: probe should return 402 with no auth');
    return;
  }

  // ── Pay with `exact` scheme.
  console.log(sub('Paying with x402 exact scheme'));
  try {
    const res = await payAndRetry('/api/fortune/premium', { category: 'love' }, 'exact');
    describeSettleResponse(res);
    const text = await res.text();
    console.log(`  body:             ${text.slice(0, 200)}`);
  } catch (err) {
    console.log(`  ERROR:            ${(err as Error).message}`);
  }
}

/**
 * Read the wallet's USDC + ETH balances and current Permit2 allowance. We
 * print all three so the operator immediately sees what's missing if the
 * upto tests fail.
 */
async function reportWalletState(): Promise<{
  usdc: bigint;
  eth: bigint;
  allowance: bigint;
}> {
  const publicClient = createPublicClient({ chain: base, transport: http(BASE_RPC_URL) });

  const [eth, usdc, allowance] = await Promise.all([
    publicClient.getBalance({ address: clientAccount.address }),
    publicClient.readContract({
      address: USDC_BASE,
      abi: [
        {
          type: 'function',
          name: 'balanceOf',
          stateMutability: 'view',
          inputs: [{ name: 'account', type: 'address' }],
          outputs: [{ type: 'uint256' }],
        },
      ] as const,
      functionName: 'balanceOf',
      args: [clientAccount.address],
    }),
    publicClient.readContract({
      address: USDC_BASE,
      abi: erc20AllowanceAbi,
      functionName: 'allowance',
      args: [clientAccount.address, PERMIT2_ADDRESS],
    }),
  ]);

  console.log(sub('Wallet state on Base'));
  console.log(`  address:          ${clientAccount.address}`);
  console.log(`  ETH balance:      ${formatUnits(eth, 18)} ETH`);
  console.log(`  USDC balance:     ${formatUnits(usdc, 6)} USDC`);
  console.log(
    `  Permit2 allowance: ${allowance >= 2n ** 200n ? 'MAX (approved)' : formatUnits(allowance, 6) + ' USDC'}`,
  );
  return { usdc, eth, allowance };
}

/**
 * Ensures the test wallet has approved Permit2 to spend USDC. If not, sends
 * the one-time `USDC.approve(PERMIT2_ADDRESS, MaxUint256)` transaction and
 * waits for confirmation. Skipped when there's no ETH for gas (returns false
 * so the caller can short-circuit the upto tests).
 */
async function ensurePermit2Approval(state: {
  usdc: bigint;
  eth: bigint;
  allowance: bigint;
}): Promise<boolean> {
  if (state.allowance >= MIN_ALLOWANCE) {
    console.log(`  Permit2 already approved — skipping approval tx`);
    return true;
  }
  console.log(sub('Permit2 approval required'));
  console.log(`  current allowance: ${formatUnits(state.allowance, 6)} USDC`);
  console.log(`  target:            MaxUint256 (one-time approval)`);

  if (state.eth === 0n) {
    console.log(`  ERROR: wallet has no ETH on Base — cannot send approval tx`);
    console.log(`         send ~0.0005 ETH to ${clientAccount.address} on Base, then retry`);
    return false;
  }
  if (state.usdc < MIN_ALLOWANCE) {
    console.log(
      `  WARNING: USDC balance ${formatUnits(state.usdc, 6)} is below MIN_ALLOWANCE ($0.10)`,
    );
    console.log(`           approval will still succeed but settlement will fail without USDC`);
  }

  const tx = createPermit2ApprovalTx(USDC_BASE);
  console.log(`  approval tx.to:   ${tx.to}`);
  console.log(`  approval tx.data: ${tx.data.slice(0, 40)}...`);

  const walletClient = createWalletClient({
    account: clientAccount,
    chain: base,
    transport: http(BASE_RPC_URL),
  });
  const publicClient = createPublicClient({ chain: base, transport: http(BASE_RPC_URL) });

  try {
    const hash = await walletClient.sendTransaction({
      to: tx.to as `0x${string}`,
      data: tx.data as `0x${string}`,
    });
    console.log(`  submitted:        ${hash}`);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log(`  confirmed:        block ${receipt.blockNumber} (${receipt.status})`);
    return receipt.status === 'success';
  } catch (err) {
    console.log(`  ERROR sending approval: ${(err as Error).message}`);
    return false;
  }
}

async function runUptoDynamicFlow(): Promise<void> {
  console.log(banner('Test 2 — Dynamic `upto` scheme on /api/fortune/llm'));
  console.log('(Same route exposes MPP sessions — see test-session-alignment.ts)');

  // ── Probe first to see the 402 challenge. This route is configured with
  // both x402 (exact + upto) and MPP (intent=session / charge) protocols,
  // so the challenge should advertise multiple ways to pay. The client
  // picks one based on what it has registered.
  const probeRes = await probe('/api/fortune/llm', { prompt: 'Tell me a fortune.' });
  describeChallenge('fortune/llm (dynamic, tickCost=$0.001, maxPrice=$0.01)', probeRes);

  if (probeRes.status !== 402) {
    console.log('UNEXPECTED: probe should return 402 with no auth');
    return;
  }

  // ── Pay with `upto` scheme. Permit2Proxy enforces ≤ maxPrice on chain,
  // and the router's settlement override pegs the actual settle amount to
  // `tickCost` ($0.001) — strictly less than the $0.01 authorized cap.
  console.log(sub('Paying with x402 upto scheme'));
  try {
    const res = await payAndRetry('/api/fortune/llm', { prompt: 'Request 1' }, 'upto');
    describeSettleResponse(res);
    const text = await res.text();
    console.log(`  body:             ${text.slice(0, 200)}`);
  } catch (err) {
    console.log(`  ERROR:            ${(err as Error).message}`);
  }
}

async function runUptoMultiRequestFlow(): Promise<void> {
  console.log(banner('Test 3 — Multi-request via x402 upto (no session state)'));
  console.log('Each request is a fresh Permit2 authorization — contrast with MPP');
  console.log('sessions, which open a single channel and reuse it across requests.');

  const REQUEST_COUNT = 3;
  for (let i = 1; i <= REQUEST_COUNT; i++) {
    console.log(sub(`Request ${i}/${REQUEST_COUNT}`));
    try {
      const res = await payAndRetry('/api/fortune/llm', { prompt: `Request ${i}` }, 'upto');
      describeSettleResponse(res);
      const text = await res.text();
      console.log(`  body:             ${text.slice(0, 160)}`);
    } catch (err) {
      console.log(`  ERROR:            ${(err as Error).message}`);
      if (i === 1) {
        // First request failed — likely Permit2 allowance / fund-related.
        // Skip the remaining attempts since they would fail identically.
        return;
      }
    }
  }

  console.log(sub('Summary'));
  console.log(`  total requests:   ${REQUEST_COUNT}`);
  console.log('  channel reused:   N/A — x402 has no channel concept');
  console.log('  per-request cost: tickCost ($0.001) settled atomically');
}

async function main(): Promise<void> {
  console.log(banner('Router x402 exact + upto smoke test'));
  console.log(`Server:        ${BASE_URL}`);
  console.log(`Client wallet: ${clientAccount.address}`);
  console.log(`Network:       ${BASE_NETWORK} (Base mainnet, USDC)`);

  // Sanity-check the server is reachable.
  try {
    const ping = await fetch(`${BASE_URL}/.well-known/x402`);
    console.log(`Server reachable (status ${ping.status})`);
  } catch (err) {
    console.error(`Server not reachable at ${BASE_URL}: ${(err as Error).message}`);
    console.error('Start the dev server with: pnpm dev');
    process.exit(1);
  }

  // Pre-build the HTTP client once to surface any registration errors up front.
  buildHttpClient();

  // ── Surface wallet state and ensure Permit2 approval before upto tests.
  // The exact-scheme test (#1) doesn't need this — EIP-3009 takes no on-chain
  // setup. The upto tests (#2 + #3) do.
  console.log(banner('Pre-flight: wallet + Permit2 approval'));
  let canRunUpto = false;
  try {
    const state = await reportWalletState();
    canRunUpto = await ensurePermit2Approval(state);
  } catch (err) {
    console.log(`  ERROR reading wallet state: ${(err as Error).message}`);
    console.log(`  Continuing — upto tests will likely fail.`);
  }

  await runExactStaticFlow();
  if (canRunUpto) {
    await runUptoDynamicFlow();
    await runUptoMultiRequestFlow();
  } else {
    console.log(banner('Skipping upto tests — Permit2 not approved'));
    console.log(`Send USDC + a tiny amount of ETH to ${clientAccount.address} on Base, then retry.`);
  }
  console.log(banner('Done'));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
