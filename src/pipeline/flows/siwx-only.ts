import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { buildSIWXExtension, SIWX_ERROR_MESSAGES, verifySIWX } from '../../auth/siwx.js';
import { SIWX_CHALLENGE_EXPIRY_MS } from '../../kv-store/index.js';
import { normalizeWalletAddress } from '../../auth/normalize-wallet.js';
import { HEADERS } from '../../headers.js';
import { detectProtocol } from '../../protocols/detect.js';
import { verifyMppSiwx } from '../../protocols/mpp/siwx-mode.js';
import type { X402AcceptConfig } from '../../types.js';
import {
  fail,
  fireAuthVerified,
  firePluginResponse,
  type FlowCtx,
  parseBody,
  runHandlerOnly,
  runValidate,
} from '../steps/index.js';

export async function runSiwxOnlyFlow(ctx: FlowCtx): Promise<NextResponse> {
  const { request, routeEntry, deps } = ctx;

  if (routeEntry.validateFn && routeEntry.bodySchema && !request.headers.get(HEADERS.SIWX)) {
    const earlyClone = request.clone() as NextRequest;
    const earlyBody = await parseBody(ctx, earlyClone);
    if (earlyBody.ok) {
      const validateErr = await runValidate(ctx, earlyBody.data);
      if (validateErr) return validateErr;
    } else {
      return earlyBody.response;
    }
  }

  const siwxHeader = request.headers.get(HEADERS.SIWX);
  const protocol = detectProtocol(request);

  if (!siwxHeader && protocol === 'mpp' && deps.mppx) {
    let mppSiwxResult: Awaited<ReturnType<typeof verifyMppSiwx>>;
    try {
      mppSiwxResult = await verifyMppSiwx(request, deps.mppx);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      ctx.report('critical', `MPP SIWX verification failed: ${message}`);
      return fail(ctx, 500, `MPP SIWX verification failed: ${message}`);
    }

    if (mppSiwxResult.valid) {
      ctx.pluginCtx.setVerifiedWallet(mppSiwxResult.wallet);
      fireAuthVerified(ctx, { authMode: 'siwx', wallet: mppSiwxResult.wallet });
      const authResponse = await runHandlerOnly(ctx, mppSiwxResult.wallet, undefined);
      if (authResponse.status < 400) {
        return mppSiwxResult.withReceipt(authResponse) as NextResponse;
      }
      return authResponse;
    }
  }

  if (!siwxHeader) {
    return buildSiwxChallenge(ctx);
  }

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
  fireAuthVerified(ctx, { authMode: 'siwx', wallet });
  return runHandlerOnly(ctx, wallet, undefined);
}

async function buildSiwxChallenge(ctx: FlowCtx): Promise<NextResponse> {
  const { request, routeEntry, deps } = ctx;

  const url = new URL(request.url);
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
    /* optional enrichment */
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
    ctx.report(
      'warn',
      `SIWX challenge header encoding failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const response = new NextResponse(JSON.stringify(paymentRequired), {
    status: 402,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
  if (encoded) response.headers.set(HEADERS.X402_PAYMENT_REQUIRED, encoded);

  if (deps.mppx) {
    try {
      const mppChallenge = await deps.mppx.charge({ amount: '0' })(request);
      if (mppChallenge.status === 402) {
        const wwwAuth = mppChallenge.challenge.headers.get(HEADERS.WWW_AUTHENTICATE);
        if (wwwAuth) response.headers.set(HEADERS.WWW_AUTHENTICATE, wwwAuth);
      }
    } catch {
      /* optional enrichment */
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
