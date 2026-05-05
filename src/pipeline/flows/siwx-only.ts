import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { buildSIWXExtension, SIWX_ERROR_MESSAGES, verifySIWX } from '../../auth/siwx.js';
import { SIWX_CHALLENGE_EXPIRY_MS } from '../../auth/nonce.js';
import { normalizeWalletAddress } from '../../auth/normalize-wallet.js';
import { HEADERS } from '../../headers.js';
import { firePluginHook } from '../../plugin.js';
import { detectProtocol } from '../../protocols/detect.js';
import { verifyMppSiwx } from '../../protocols/mpp/siwx-mode.js';
import type { X402AcceptConfig } from '../../types.js';
import {
  fail,
  firePluginResponse,
  type FlowCtx,
  parseBody,
  runHandlerOnly,
  runValidate,
} from '../context/index.js';

export async function runSiwxOnlyFlow(ctx: FlowCtx): Promise<NextResponse> {
  const { request, routeEntry, deps } = ctx;

  // Early body parse + validate when validateFn is configured. With validateFn
  // present the route can't accept invalid bodies even for discovery probes —
  // return 400 immediately instead of presenting the SIWX challenge.
  if (routeEntry.validateFn && routeEntry.bodySchema && !request.headers.get(HEADERS.SIWX)) {
    const earlyClone = request.clone() as NextRequest;
    const earlyBody = await parseBody(earlyClone, routeEntry);
    if (earlyBody.ok) {
      const validateErr = await runValidate(ctx, earlyBody.data);
      if (validateErr) return validateErr;
    } else {
      firePluginResponse(ctx, earlyBody.response);
      return earlyBody.response;
    }
  }

  const siwxHeader = request.headers.get(HEADERS.SIWX);
  const protocol = detectProtocol(request);

  // MPP-as-SIWX shortcut: a $0 MPP credential proves wallet identity for
  // tempo clients that don't implement SIWX directly.
  if (!siwxHeader && protocol === 'mpp' && deps.mppx) {
    let mppSiwxResult: Awaited<ReturnType<typeof verifyMppSiwx>>;
    try {
      mppSiwxResult = await verifyMppSiwx(request, deps.mppx);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      firePluginHook(deps.plugin, 'onAlert', ctx.pluginCtx, {
        level: 'critical' as const,
        message: `MPP SIWX verification failed: ${message}`,
        route: routeEntry.key,
      });
      return fail(ctx, 500, `MPP SIWX verification failed: ${message}`);
    }

    if (mppSiwxResult.valid) {
      ctx.pluginCtx.setVerifiedWallet(mppSiwxResult.wallet);
      firePluginHook(deps.plugin, 'onAuthVerified', ctx.pluginCtx, {
        authMode: 'siwx',
        wallet: mppSiwxResult.wallet,
        route: routeEntry.key,
      });
      const authResponse = await runHandlerOnly(ctx, mppSiwxResult.wallet, undefined);
      // Attach a $0 Payment-Receipt so tempo knows the credential was accepted.
      if (authResponse.status < 400) {
        return mppSiwxResult.withReceipt(authResponse) as NextResponse;
      }
      return authResponse;
    }
    // MPP verification failed — fall through to fresh challenge below.
  }

  // No SIWX header → return SIWX 402 challenge.
  if (!siwxHeader) {
    return buildSiwxChallenge(ctx);
  }

  // SIWX header present → verify the signed message.
  const siwx = await verifySIWX(request, routeEntry, deps.nonceStore);
  if (!siwx.valid) {
    const response = NextResponse.json(
      { error: siwx.code, message: SIWX_ERROR_MESSAGES[siwx.code] },
      { status: 402 },
    );
    firePluginResponse(ctx, response);
    return response;
  }

  const wallet = normalizeWalletAddress(siwx.wallet);
  ctx.pluginCtx.setVerifiedWallet(wallet);
  firePluginHook(deps.plugin, 'onAuthVerified', ctx.pluginCtx, {
    authMode: 'siwx',
    wallet,
    route: routeEntry.key,
  });
  return runHandlerOnly(ctx, wallet, undefined);
}

/**
 * Build a SIWX-shaped 402 challenge.
 *
 * Uniform x402v2 envelope: same `PAYMENT-REQUIRED` header + JSON body as paid
 * routes, with `accepts: []` and SIWX info under `extensions['sign-in-with-x']`.
 * MCP clients parse one shape regardless of auth mode.
 */
async function buildSiwxChallenge(ctx: FlowCtx): Promise<NextResponse> {
  const { request, routeEntry, deps } = ctx;

  const url = new URL(request.url);
  // SIWE requires alphanumeric nonce — strip hyphens from UUID
  const nonce = crypto.randomUUID().replace(/-/g, '');
  const supportedChains = getSupportedChains(deps.x402Accepts, deps.network);
  const primaryChain = supportedChains[0];
  const siwxInfo = {
    domain: url.hostname,
    uri: request.url,
    version: '1',
    chainId: primaryChain.chainId,
    type: primaryChain.type,
    nonce,
    issuedAt: new Date().toISOString(),
    expirationTime: new Date(Date.now() + SIWX_CHALLENGE_EXPIRY_MS).toISOString(),
    statement: 'Sign in to verify your wallet identity',
  };

  let siwxSchema: unknown;
  try {
    siwxSchema = await buildSIWXExtension();
  } catch {
    // SIWX schema is optional enrichment — challenge still works without it
  }

  const paymentRequired = {
    x402Version: 2,
    error: 'SIWX authentication required',
    resource: {
      url: request.url,
      description: routeEntry.description ?? 'SIWX-protected endpoint',
      mimeType: 'application/json',
    },
    accepts: [],
    extensions: {
      'sign-in-with-x': {
        info: siwxInfo,
        // Required by MCP tools at the top level for chain detection.
        supportedChains,
        ...(siwxSchema ? { schema: siwxSchema } : {}),
      },
    },
  };

  let encoded: string | undefined;
  try {
    const { encodePaymentRequiredHeader } = await import('@x402/core/http');
    encoded = encodePaymentRequiredHeader(paymentRequired);
  } catch (err) {
    // Body still carries the challenge; MCP tools that read PAYMENT-REQUIRED miss it.
    firePluginHook(deps.plugin, 'onAlert', ctx.pluginCtx, {
      level: 'warn' as const,
      message: `SIWX challenge header encoding failed: ${err instanceof Error ? err.message : String(err)}`,
      route: routeEntry.key,
    });
  }

  const response = new NextResponse(JSON.stringify(paymentRequired), {
    status: 402,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
  if (encoded) response.headers.set(HEADERS.X402_PAYMENT_REQUIRED, encoded);

  // Optional MPP WWW-Authenticate fallback so tempo clients can fulfil via $0 MPP.
  if (deps.mppx) {
    try {
      const mppChallenge = await deps.mppx.charge({ amount: '0' })(request);
      if (mppChallenge.status === 402) {
        const wwwAuth = mppChallenge.challenge.headers.get(HEADERS.WWW_AUTHENTICATE);
        if (wwwAuth) response.headers.set(HEADERS.WWW_AUTHENTICATE, wwwAuth);
      }
    } catch {
      // MPP enrichment is optional — SIWX challenge still works without it
    }
  }

  firePluginResponse(ctx, response);
  return response;
}

function siwxSignatureType(network: string): 'eip191' | 'ed25519' {
  return network.startsWith('solana:') ? 'ed25519' : 'eip191';
}

function getSupportedChains(
  x402Accepts: X402AcceptConfig[],
  fallbackNetwork: string,
): Array<{ chainId: string; type: 'eip191' | 'ed25519' }> {
  const seen = new Set<string>();
  const chains: Array<{ chainId: string; type: 'eip191' | 'ed25519' }> = [];
  for (const accept of x402Accepts) {
    if (accept.network && !seen.has(accept.network)) {
      seen.add(accept.network);
      chains.push({ chainId: accept.network, type: siwxSignatureType(accept.network) });
    }
  }
  if (chains.length === 0) {
    chains.push({ chainId: fallbackNetwork, type: siwxSignatureType(fallbackNetwork) });
  }
  return chains;
}
