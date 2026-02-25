import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type {
  RouteEntry,
  HandlerContext,
  QuotaLevel,
  ProviderQuotaEvent,
  X402Server,
} from './types.js';
import type { RouterPlugin, PluginContext, RequestMeta } from './plugin.js';
import { createDefaultContext, firePluginHook } from './plugin.js';
import { SIWX_CHALLENGE_EXPIRY_MS, type NonceStore } from './auth/nonce.js';
import { detectProtocol } from './protocols/detect.js';
import { safeCallHandler } from './handler.js';
import { bufferBody, validateBody } from './body.js';
import { resolvePrice, resolveMaxPrice } from './pricing.js';
import { Credential } from 'mppx';
import { isAddress, getAddress } from 'viem';
import { buildX402Challenge, verifyX402Payment, settleX402Payment } from './protocols/x402.js';
import { verifySIWX, buildSIWXExtension, SIWX_ERROR_MESSAGES } from './auth/siwx.js';
import { verifyApiKey } from './auth/api-key.js';

async function resolvePayTo(
  routeEntry: RouteEntry,
  request: Request,
  fallback: string,
): Promise<string> {
  if (!routeEntry.payTo) return fallback;
  if (typeof routeEntry.payTo === 'string') return routeEntry.payTo;
  return routeEntry.payTo(request);
}

export interface OrchestrateDeps {
  x402Server: X402Server | null;
  initPromise: Promise<void>;
  x402InitError?: string;
  mppInitError?: string;
  plugin?: RouterPlugin;
  nonceStore: NonceStore;
  payeeAddress: string;
  network: string;
  mppx?: {
    charge: (options: {
      amount: string;
    }) => (
      input: Request,
    ) => Promise<
      | { status: 402; challenge: Response }
      | { status: 200; withReceipt: (response: Response) => Response }
    >;
  } | null;
}

export function createRequestHandler(
  routeEntry: RouteEntry,
  handler: (ctx: HandlerContext) => Promise<unknown>,
  deps: OrchestrateDeps,
): (request: NextRequest) => Promise<NextResponse> {
  // -- Closures scoped to this route (created once at registration) --

  /** Build HandlerContext and invoke the handler. Single source of truth. */
  async function invoke(
    request: NextRequest,
    meta: RequestMeta,
    pluginCtx: PluginContext,
    wallet: string | null,
    account: unknown,
    parsedBody: unknown,
  ): Promise<{ response: NextResponse; rawResult: unknown }> {
    const ctx: HandlerContext = {
      body: parsedBody as never,
      query: parseQuery(request, routeEntry) as never,
      request,
      requestId: meta.requestId,
      route: routeEntry.key,
      wallet,
      account,
      alert(level, message, alertMeta) {
        firePluginHook(deps.plugin, 'onAlert', pluginCtx, {
          level,
          message,
          route: routeEntry.key,
          meta: alertMeta,
        });
      },
      setVerifiedWallet: (addr) => pluginCtx.setVerifiedWallet(addr),
    };

    let rawResult: unknown;
    const response = await safeCallHandler(async (c) => {
      rawResult = await handler(c as HandlerContext);
      return rawResult;
    }, ctx);

    return { response, rawResult };
  }

  /** Post-handler finalization: quota extraction + plugin response hook. */
  function finalize(
    response: NextResponse,
    rawResult: unknown,
    meta: RequestMeta,
    pluginCtx: PluginContext,
    requestBody?: unknown,
  ): void {
    fireProviderQuota(routeEntry, response, rawResult, deps, pluginCtx);
    firePluginResponse(deps, pluginCtx, meta, response, requestBody, rawResult);
  }

  /** Error response shorthand. */
  function fail(
    status: number,
    message: string,
    meta: RequestMeta,
    pluginCtx: PluginContext,
    requestBody?: unknown,
  ): NextResponse {
    const response = NextResponse.json({ success: false, error: message }, { status });
    firePluginResponse(deps, pluginCtx, meta, response, requestBody);
    return response;
  }

  // -- Request handler --

  return async (request: NextRequest): Promise<NextResponse> => {
    await deps.initPromise;

    const meta = buildMeta(request, routeEntry);
    const pluginCtx: PluginContext =
      (firePluginHook(deps.plugin, 'onRequest', meta) as PluginContext | undefined) ??
      createDefaultContext(meta);

    /** Shared non-payment tail: parse body → validate → invoke handler → finalize. */
    async function handleAuth(wallet: string | null, account: unknown): Promise<NextResponse> {
      const body = await parseBody(request, routeEntry);
      if (!body.ok) {
        firePluginResponse(deps, pluginCtx, meta, body.response);
        return body.response;
      }

      // Run pre-handler validation if configured
      if (routeEntry.validateFn) {
        try {
          await routeEntry.validateFn(body.data);
        } catch (err: unknown) {
          const status = (err as { status?: number }).status ?? 400;
          const message = err instanceof Error ? err.message : 'Validation failed';
          return fail(status, message, meta, pluginCtx, body.data);
        }
      }

      const { response, rawResult } = await invoke(
        request,
        meta,
        pluginCtx,
        wallet,
        account,
        body.data,
      );
      finalize(response, rawResult, meta, pluginCtx, body.data);
      return response;
    }

    // ---- Unprotected ----
    if (routeEntry.authMode === 'unprotected') {
      return handleAuth(null, undefined);
    }

    // ---- API key (runs before payment) ----
    let account: unknown;
    if (routeEntry.authMode === 'apiKey' || routeEntry.apiKeyResolver) {
      if (!routeEntry.apiKeyResolver) {
        return fail(401, 'API key resolver not configured', meta, pluginCtx);
      }
      const keyResult = await verifyApiKey(request, routeEntry.apiKeyResolver);
      if (!keyResult.valid) {
        return fail(401, 'Invalid or missing API key', meta, pluginCtx);
      }
      account = keyResult.account;

      // Fire auth hook for API key verification
      firePluginHook(deps.plugin, 'onAuthVerified', pluginCtx, {
        authMode: 'apiKey',
        wallet: null,
        route: routeEntry.key,
        account,
      });

      if (routeEntry.authMode === 'apiKey' && !routeEntry.pricing) {
        return handleAuth(null, account);
      }
    }

    const protocol = detectProtocol(request);

    // ---- Early body parsing for dynamic pricing or validation ----
    // If no payment header and (dynamic pricing OR validateFn) exists, clone request
    // and parse body early so we can calculate accurate price and/or reject invalid
    // requests before showing the 402 challenge.
    let earlyBodyData: unknown;
    const pricingNeedsBody = routeEntry.pricing != null && typeof routeEntry.pricing !== 'string';
    const needsEarlyParse =
      !protocol && routeEntry.bodySchema && (pricingNeedsBody || routeEntry.validateFn);

    if (needsEarlyParse) {
      // CRITICAL: Clone BEFORE consuming body (stream can only be read once)
      // Direct cast: clone() returns Request but the runtime object is still NextRequest
      // with all properties intact. TypeScript doesn't track this through clone().
      const requestForPricing = request.clone() as NextRequest;

      // Parse clone for pricing/validation.
      // On failure, earlyBodyData stays undefined so build402 falls back to
      // maxPrice. This ensures discovery probes (empty body, no payment header)
      // still receive a 402 challenge. Real validation errors surface later
      // when a payment IS present (line 374+).
      const earlyBodyResult = await parseBody(requestForPricing, routeEntry);

      if (earlyBodyResult.ok) {
        earlyBodyData = earlyBodyResult.data;

        // Run pre-payment validation if configured.
        // Unlike body parse failures (which fall through to 402 for discovery),
        // validateFn errors on a valid body are intentional rejections (e.g.
        // "domain taken", "rate limited") and should surface immediately.
        if (routeEntry.validateFn) {
          try {
            await routeEntry.validateFn(earlyBodyData);
          } catch (err: unknown) {
            const status = (err as { status?: number }).status ?? 400;
            const message = err instanceof Error ? err.message : 'Validation failed';
            return fail(status, message, meta, pluginCtx, earlyBodyData);
          }
        }
      }
      // Body parse failed — earlyBodyData stays undefined so build402 falls
      // back to maxPrice. This ensures discovery probes (empty/invalid body,
      // no payment header) still receive a 402 challenge.
    }

    // ---- SIWX ----
    // SIWX runs before body parsing: the wallet address is needed for
    // handler context, and there's no price to resolve. This avoids
    // unnecessary body buffering for unauthenticated requests.
    if (routeEntry.authMode === 'siwx') {
      // Early body parsing + validation for SIWX routes with validateFn.
      // Body parse failures fall through to the SIWX challenge so discovery
      // probes aren't blocked. validateFn errors on valid bodies still
      // reject immediately (same as paid routes).
      if (
        routeEntry.validateFn &&
        routeEntry.bodySchema &&
        !request.headers.get('SIGN-IN-WITH-X')
      ) {
        const requestForValidation = request.clone() as NextRequest;
        const earlyBodyResult = await parseBody(requestForValidation, routeEntry);
        if (earlyBodyResult.ok) {
          try {
            await routeEntry.validateFn(earlyBodyResult.data);
          } catch (err: unknown) {
            const status = (err as { status?: number }).status ?? 400;
            const message = err instanceof Error ? err.message : 'Validation failed';
            return fail(status, message, meta, pluginCtx, earlyBodyResult.data);
          }
        }
      }

      if (!request.headers.get('SIGN-IN-WITH-X')) {
        // Uniform 402 challenge format: SIWX routes return the same x402v2
        // challenge structure as paid routes, with PAYMENT-REQUIRED header
        // and JSON body. MCP clients parse one response format regardless
        // of auth mode. SIWX info goes in extensions['sign-in-with-x'].
        // accepts: [] signals "no payment needed, just prove identity."
        const url = new URL(request.url);
        // SIWE requires alphanumeric nonce — strip hyphens from UUID
        const nonce = crypto.randomUUID().replace(/-/g, '');
        const siwxInfo = {
          domain: url.hostname,
          uri: request.url,
          version: '1',
          chainId: deps.network,
          type: 'eip191',
          nonce,
          issuedAt: new Date().toISOString(),
          expirationTime: new Date(Date.now() + SIWX_CHALLENGE_EXPIRY_MS).toISOString(),
          statement: 'Sign in to verify your wallet identity',
        };

        let siwxSchema: unknown;
        try {
          siwxSchema = await buildSIWXExtension();
        } catch {
          // SIWX schema is optional enrichment — challenge works without it
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
              // supportedChains at top level required by MCP tools for chain detection
              supportedChains: [{ chainId: deps.network, type: 'eip191' }],
              ...(siwxSchema ? { schema: siwxSchema } : {}),
            },
          },
        };

        let encoded: string | undefined;
        try {
          const { encodePaymentRequiredHeader } = await import('@x402/core/http');
          encoded = encodePaymentRequiredHeader(paymentRequired);
        } catch (err) {
          // Header encoding failure: JSON body still carries the challenge,
          // but MCP tools that parse PAYMENT-REQUIRED header will miss it.
          firePluginHook(deps.plugin, 'onAlert', pluginCtx, {
            level: 'warn' as const,
            message: `SIWX challenge header encoding failed: ${err instanceof Error ? err.message : String(err)}`,
            route: routeEntry.key,
          });
        }

        const response = new NextResponse(JSON.stringify(paymentRequired), {
          status: 402,
          headers: { 'Content-Type': 'application/json' },
        });
        if (encoded) response.headers.set('PAYMENT-REQUIRED', encoded);
        firePluginResponse(deps, pluginCtx, meta, response);
        return response;
      }

      const siwx = await verifySIWX(request, routeEntry, deps.nonceStore);
      if (!siwx.valid) {
        // Return structured error with code for client auto-retry
        const response = NextResponse.json(
          { error: siwx.code, message: SIWX_ERROR_MESSAGES[siwx.code] },
          { status: 402 },
        );
        firePluginResponse(deps, pluginCtx, meta, response);
        return response;
      }

      // Normalize to lowercase — checksumming is a display concern, not storage
      const wallet = siwx.wallet.toLowerCase();
      pluginCtx.setVerifiedWallet(wallet);
      firePluginHook(deps.plugin, 'onAuthVerified', pluginCtx, {
        authMode: 'siwx',
        wallet,
        route: routeEntry.key,
      });
      return handleAuth(wallet, undefined);
    }

    // ---- No payment header → 402 challenge ----
    if (!protocol || protocol === 'siwx') {
      // If any configured protocol failed to init, return 500 with the errors.
      // A partial 402 (missing protocols) leads to confusing client errors.
      if (routeEntry.pricing) {
        const initErrors = routeEntry.protocols
          .map((p) => {
            if (p === 'x402' && deps.x402InitError) return `x402: ${deps.x402InitError}`;
            if (p === 'mpp' && deps.mppInitError) return `mpp: ${deps.mppInitError}`;
            return null;
          })
          .filter(Boolean);
        if (initErrors.length > 0) {
          return fail(
            500,
            `Payment protocol initialization failed. ${initErrors.join('; ')}`,
            meta,
            pluginCtx,
          );
        }
      }
      return await build402(request, routeEntry, deps, meta, pluginCtx, earlyBodyData);
    }

    // ---- Payment present: parse body + validate + resolve price ----
    const body = await parseBody(request, routeEntry);
    if (!body.ok) {
      firePluginResponse(deps, pluginCtx, meta, body.response);
      return body.response;
    }

    // Run validation before price resolution (reject invalid requests before charging)
    if (routeEntry.validateFn) {
      try {
        await routeEntry.validateFn(body.data);
      } catch (err: unknown) {
        const status = (err as { status?: number }).status ?? 400;
        const message = err instanceof Error ? err.message : 'Validation failed';
        return fail(status, message, meta, pluginCtx, body.data);
      }
    }

    let price: string;
    try {
      price = await resolvePrice(routeEntry.pricing!, body.data);
    } catch (err: unknown) {
      return fail(
        (err as { status?: number }).status ?? 500,
        err instanceof Error ? err.message : 'Price resolution failed',
        meta,
        pluginCtx,
        body.data,
      );
    }

    // ---- Protocol mismatch check ----
    // Client sent payment via a protocol this route doesn't accept.
    // Return 400 so the client knows to use a different protocol, not 402
    // which would cause an infinite retry loop.
    if (!routeEntry.protocols.includes(protocol)) {
      const accepted = routeEntry.protocols.join(', ') || 'none';
      console.warn(
        `[router] ${routeEntry.key}: received ${protocol} payment but route accepts [${accepted}]`,
      );
      return fail(
        400,
        `This route does not accept ${protocol} payments. Accepted protocols: ${accepted}`,
        meta,
        pluginCtx,
        body.data,
      );
    }

    // ---- x402 ----
    if (protocol === 'x402') {
      if (!deps.x402Server) {
        const reason = deps.x402InitError
          ? `x402 facilitator initialization failed: ${deps.x402InitError}`
          : 'x402 server not initialized — ensure @x402/core, @x402/evm, and @coinbase/x402 are installed';
        console.error(`[router] ${routeEntry.key}: ${reason}`);
        return fail(500, reason, meta, pluginCtx, body.data);
      }

      const payTo = await resolvePayTo(routeEntry, request, deps.payeeAddress);
      const verify = await verifyX402Payment(
        deps.x402Server,
        request,
        routeEntry,
        price,
        payTo,
        deps.network,
      );
      if (!verify?.valid) return await build402(request, routeEntry, deps, meta, pluginCtx);

      const { payload: verifyPayload, requirements: verifyRequirements } = verify;

      // Normalize to lowercase — checksumming is a display concern, not storage
      const wallet = verify.payer.toLowerCase();
      pluginCtx.setVerifiedWallet(wallet);
      firePluginHook(deps.plugin, 'onPaymentVerified', pluginCtx, {
        protocol: 'x402',
        payer: wallet,
        amount: price,
        network: deps.network,
      });

      const { response, rawResult } = await invoke(
        request,
        meta,
        pluginCtx,
        wallet,
        account,
        body.data,
      );

      if (response.status < 400) {
        try {
          const payloadFingerprint =
            typeof verifyPayload === 'object' && verifyPayload !== null
              ? {
                  keys: Object.keys(verifyPayload as object)
                    .sort()
                    .join(','),
                  payloadType: typeof verifyPayload,
                }
              : { payloadType: typeof verifyPayload };
          console.info('Settlement attempt', {
            route: routeEntry.key,
            network: deps.network,
            ...payloadFingerprint,
          });
          const settle = await settleX402Payment(
            deps.x402Server,
            verifyPayload,
            verifyRequirements,
          );
          response.headers.set('PAYMENT-RESPONSE', settle.encoded);
          firePluginHook(deps.plugin, 'onPaymentSettled', pluginCtx, {
            protocol: 'x402',
            payer: verify.payer,
            transaction: String(settle.result?.transaction ?? ''),
            network: deps.network,
          });
        } catch (err) {
          const errObj = err as {
            message?: string;
            response?: { status?: number; data?: unknown; body?: unknown };
          };
          console.error('Settlement failed', {
            message: err instanceof Error ? err.message : String(err),
            route: routeEntry.key,
            network: deps.network,
            facilitatorStatus: errObj.response?.status,
            facilitatorBody: errObj.response?.data ?? errObj.response?.body,
          });
          firePluginHook(deps.plugin, 'onAlert', pluginCtx, {
            level: 'critical' as const,
            message: `Settlement failed: ${err instanceof Error ? err.message : String(err)}`,
            route: routeEntry.key,
          });
          return fail(500, 'Settlement failed', meta, pluginCtx, body.data);
        }
      }

      finalize(response, rawResult, meta, pluginCtx, body.data);
      return response;
    }

    // ---- MPP ----
    if (protocol === 'mpp') {
      if (!deps.mppx) {
        const reason = deps.mppInitError
          ? `MPP initialization failed: ${deps.mppInitError}`
          : 'MPP not initialized — ensure mppx is installed and mpp config (secretKey, currency, recipient) is correct';
        console.error(`[router] ${routeEntry.key}: ${reason}`);
        return fail(500, reason, meta, pluginCtx, body.data);
      }

      let mppResult: Awaited<ReturnType<ReturnType<typeof deps.mppx.charge>>>;
      try {
        mppResult = await deps.mppx.charge({ amount: price })(request);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[router] ${routeEntry.key}: MPP charge failed: ${message}`);
        firePluginHook(deps.plugin, 'onAlert', pluginCtx, {
          level: 'critical' as const,
          message: `MPP charge failed: ${message}`,
          route: routeEntry.key,
        });
        return fail(500, `MPP payment processing failed: ${message}`, meta, pluginCtx, body.data);
      }

      if (mppResult.status === 402) {
        // Client sent a credential but charge() rejected it. This could be:
        // 1. Legitimate rejection (expired, tampered, wrong amount) → 402 is correct
        // 2. Server-side config issue (missing TEMPO_RPC_URL) → should be 500
        // We can't distinguish these from the return value alone, so log a warning
        // to help operators diagnose. If this shows up repeatedly, it's likely (2).
        console.warn(
          `[router] ${routeEntry.key}: MPP credential present but charge() returned 402 — credential may be invalid, or check TEMPO_RPC_URL configuration`,
        );
        firePluginHook(deps.plugin, 'onAlert', pluginCtx, {
          level: 'warn' as const,
          message:
            'MPP payment rejected despite credential present — possible config issue (TEMPO_RPC_URL)',
          route: routeEntry.key,
        });
        return await build402(request, routeEntry, deps, meta, pluginCtx);
      }

      // Payment verified — extract wallet from credential source (DID)
      // MPP source format: "did:pkh:eip155:<chainId>:<address>"
      // Normalize to plain address for consistency with x402/SIWX flows
      const credential = Credential.fromRequest(request);
      const rawSource = credential?.source ?? '';
      const didParts = rawSource.split(':');
      const lastPart = didParts[didParts.length - 1];
      const wallet = (isAddress(lastPart) ? getAddress(lastPart) : rawSource).toLowerCase();

      pluginCtx.setVerifiedWallet(wallet);
      firePluginHook(deps.plugin, 'onPaymentVerified', pluginCtx, {
        protocol: 'mpp',
        payer: wallet,
        amount: price,
        network: 'tempo:4217',
      });

      const { response, rawResult } = await invoke(
        request,
        meta,
        pluginCtx,
        wallet,
        account,
        body.data,
      );

      if (response.status < 400) {
        const receiptResponse = mppResult.withReceipt(response);
        finalize(receiptResponse as NextResponse, rawResult, meta, pluginCtx, body.data);
        return receiptResponse as NextResponse;
      }

      finalize(response, rawResult, meta, pluginCtx, body.data);
      return response;
    }

    return await build402(request, routeEntry, deps, meta, pluginCtx);
  };
}

// ---------------------------------------------------------------------------
// Body parsing
// ---------------------------------------------------------------------------

async function parseBody(
  request: NextRequest,
  routeEntry: RouteEntry,
): Promise<{ ok: true; data: unknown } | { ok: false; response: NextResponse }> {
  if (!routeEntry.bodySchema) return { ok: true, data: undefined };
  const raw = await bufferBody(request);
  const result = validateBody(raw, routeEntry.bodySchema);
  if (result.success) return { ok: true, data: result.data };
  return {
    ok: false,
    response: NextResponse.json(
      { success: false, error: result.error, issues: result.issues },
      { status: 400 },
    ),
  };
}

// ---------------------------------------------------------------------------
// Request metadata
// ---------------------------------------------------------------------------

function buildMeta(request: NextRequest, routeEntry: RouteEntry): RequestMeta {
  return {
    requestId: crypto.randomUUID(),
    method: request.method,
    route: routeEntry.key,
    origin: request.headers.get('origin') ?? new URL(request.url).origin,
    referer: request.headers.get('referer'),
    walletAddress: request.headers.get('X-Wallet-Address'),
    clientId: request.headers.get('X-Client-ID'),
    sessionId: request.headers.get('X-Session-ID'),
    contentType: request.headers.get('content-type'),
    headers: Object.fromEntries(request.headers.entries()),
    startTime: Date.now(),
  };
}

// ---------------------------------------------------------------------------
// Query parsing
// ---------------------------------------------------------------------------

function parseQuery(request: NextRequest, routeEntry: RouteEntry): unknown {
  if (!routeEntry.querySchema) return undefined;
  const params = Object.fromEntries(request.nextUrl.searchParams.entries());
  const result = routeEntry.querySchema.safeParse(params);
  return result.success ? result.data : params;
}

// ---------------------------------------------------------------------------
// Dynamic pricing resolution
// ---------------------------------------------------------------------------

/** Resolve dynamic pricing with maxPrice safety net and fallback handling. */
async function resolveDynamicPrice(
  bodyData: unknown,
  routeEntry: RouteEntry,
  deps: OrchestrateDeps,
  pluginCtx: PluginContext,
  meta: RequestMeta,
): Promise<{ price: string } | { error: NextResponse }> {
  try {
    let price = await resolvePrice(routeEntry.pricing!, bodyData);

    // Validate against maxPrice ceiling if set
    if (routeEntry.maxPrice) {
      const calculated = parseFloat(price);
      const max = parseFloat(routeEntry.maxPrice);

      if (calculated > max) {
        // Cap at maxPrice and fire warning
        firePluginHook(deps.plugin, 'onAlert', pluginCtx, {
          level: 'warn' as const,
          message: `Price ${price} exceeds maxPrice ${routeEntry.maxPrice}, capping`,
          route: routeEntry.key,
          meta: { calculated: price, maxPrice: routeEntry.maxPrice, body: bodyData },
        });
        price = routeEntry.maxPrice;
      }
    }

    return { price };
  } catch (err: unknown) {
    // Pricing function failed
    firePluginHook(deps.plugin, 'onAlert', pluginCtx, {
      level: 'error' as const,
      message: `Pricing function failed: ${err instanceof Error ? err.message : String(err)}`,
      route: routeEntry.key,
      meta: { error: err instanceof Error ? err.stack : String(err), body: bodyData },
    });

    if (routeEntry.maxPrice) {
      // Fall back to maxPrice (degraded mode)
      firePluginHook(deps.plugin, 'onAlert', pluginCtx, {
        level: 'warn' as const,
        message: `Using maxPrice ${routeEntry.maxPrice} as fallback after pricing error`,
        route: routeEntry.key,
      });
      return { price: routeEntry.maxPrice };
    } else {
      // No fallback available - fail fast
      const errorResponse = NextResponse.json(
        { success: false, error: 'Price calculation failed' },
        { status: 500 },
      );
      firePluginResponse(deps, pluginCtx, meta, errorResponse);
      return { error: errorResponse };
    }
  }
}

// ---------------------------------------------------------------------------
// 402 challenge
// ---------------------------------------------------------------------------

async function build402(
  request: NextRequest,
  routeEntry: RouteEntry,
  deps: OrchestrateDeps,
  meta: RequestMeta,
  pluginCtx: PluginContext,
  bodyData?: unknown,
): Promise<NextResponse> {
  const response = new NextResponse(null, {
    status: 402,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  let challengePrice: string;

  // Dynamic/tiered pricing with body data (early parsing happened)
  if (
    bodyData !== undefined &&
    typeof routeEntry.pricing !== 'string' &&
    routeEntry.pricing != null
  ) {
    const result = await resolveDynamicPrice(bodyData, routeEntry, deps, pluginCtx, meta);
    if ('error' in result) return result.error;
    challengePrice = result.price;
  }
  // Static pricing (unchanged)
  else if (routeEntry.maxPrice) {
    challengePrice = routeEntry.maxPrice;
  }
  // Tiered pricing (unchanged)
  else if (routeEntry.pricing) {
    try {
      challengePrice = resolveMaxPrice(routeEntry.pricing);
    } catch {
      challengePrice = '0';
    }
  }
  // No pricing configured
  else {
    challengePrice = '0';
  }

  // Bazaar extensions from schemas
  let extensions: Record<string, unknown> | undefined;
  try {
    const { z } = await import('zod');
    const { declareDiscoveryExtension } = await import('@x402/extensions/bazaar');
    const inputSchema = routeEntry.bodySchema
      ? z.toJSONSchema(routeEntry.bodySchema, { target: 'draft-2020-12' })
      : routeEntry.querySchema
        ? z.toJSONSchema(routeEntry.querySchema, { target: 'draft-2020-12' })
        : undefined;
    const outputSchema = routeEntry.outputSchema
      ? z.toJSONSchema(routeEntry.outputSchema, { target: 'draft-2020-12' })
      : undefined;
    if (inputSchema) {
      const config: Record<string, unknown> = {
        bodyType: routeEntry.bodySchema ? 'json' : undefined,
        inputSchema,
      };
      if (outputSchema) config.output = { schema: outputSchema, example: {} };
      extensions = declareDiscoveryExtension(config);
    }
  } catch {
    // Bazaar extensions are optional enrichment for 402 challenges
  }

  if (routeEntry.protocols.includes('x402') && deps.x402Server) {
    try {
      const payTo = await resolvePayTo(routeEntry, request, deps.payeeAddress);
      const { encoded } = await buildX402Challenge(
        deps.x402Server,
        routeEntry,
        request,
        challengePrice,
        payTo,
        deps.network,
        extensions,
      );
      response.headers.set('PAYMENT-REQUIRED', encoded);
    } catch (err) {
      // x402 challenge failure is critical: a bare 402 with no PAYMENT-REQUIRED
      // header is useless — clients can't pay. Return 500 so operators see the
      // init failure instead of silent payment breakage.
      const message = `x402 challenge build failed: ${err instanceof Error ? err.message : String(err)}`;
      firePluginHook(deps.plugin, 'onAlert', pluginCtx, {
        level: 'critical' as const,
        message,
        route: routeEntry.key,
      });
      const errorResponse = NextResponse.json({ success: false, error: message }, { status: 500 });
      firePluginResponse(deps, pluginCtx, meta, errorResponse);
      return errorResponse;
    }
  }

  if (routeEntry.protocols.includes('mpp') && deps.mppx) {
    try {
      const result = await deps.mppx.charge({ amount: challengePrice })(request);
      if (result.status === 402) {
        const wwwAuth = result.challenge.headers.get('WWW-Authenticate');
        if (wwwAuth) response.headers.set('WWW-Authenticate', wwwAuth);
      }
    } catch (err) {
      firePluginHook(deps.plugin, 'onAlert', pluginCtx, {
        level: 'critical' as const,
        message: `MPP challenge build failed: ${err instanceof Error ? err.message : String(err)}`,
        route: routeEntry.key,
      });
    }
  }

  firePluginResponse(deps, pluginCtx, meta, response);
  return response;
}

// ---------------------------------------------------------------------------
// Plugin response hook
// ---------------------------------------------------------------------------

function firePluginResponse(
  deps: OrchestrateDeps,
  pluginCtx: PluginContext,
  meta: RequestMeta,
  response: NextResponse,
  requestBody?: unknown,
  responseBody?: unknown,
): void {
  firePluginHook(deps.plugin, 'onResponse', pluginCtx, {
    statusCode: response.status,
    statusText: response.statusText,
    duration: Date.now() - meta.startTime,
    contentType: response.headers.get('content-type'),
    headers: Object.fromEntries(response.headers.entries()),
    requestBody,
    responseBody,
  });

  // 402 is a payment challenge, not an error
  if (response.status >= 400 && response.status !== 402) {
    firePluginHook(deps.plugin, 'onError', pluginCtx, {
      status: response.status,
      message: response.statusText || `HTTP ${response.status}`,
      settled: false,
    });
  }
}

// ---------------------------------------------------------------------------
// Provider quota
// ---------------------------------------------------------------------------

function computeQuotaLevel(remaining: number | null, warn?: number, critical?: number): QuotaLevel {
  if (remaining === null) return 'healthy';
  if (critical !== undefined && remaining <= critical) return 'critical';
  if (warn !== undefined && remaining <= warn) return 'warn';
  return 'healthy';
}

function fireProviderQuota(
  routeEntry: RouteEntry,
  response: NextResponse,
  handlerResult: unknown,
  deps: OrchestrateDeps,
  pluginCtx: PluginContext,
): void {
  const { providerName, providerConfig } = routeEntry;
  if (!providerName || !providerConfig?.extractQuota) return;
  if (response.status >= 400) return;

  try {
    const quota = providerConfig.extractQuota(handlerResult, response.headers);
    if (!quota) return;

    const level = computeQuotaLevel(quota.remaining, providerConfig.warn, providerConfig.critical);
    const overage = providerConfig.overage ?? 'same-rate';

    const event: ProviderQuotaEvent = {
      provider: providerName,
      route: routeEntry.key,
      remaining: quota.remaining,
      limit: quota.limit,
      spend: quota.spend,
      level,
      overage,
      message:
        quota.remaining !== null
          ? `${providerName}: ${quota.remaining}${quota.limit ? `/${quota.limit}` : ''} remaining`
          : `${providerName}: quota info unavailable`,
    };

    firePluginHook(deps.plugin, 'onProviderQuota', pluginCtx, event);
  } catch {
    // Fire-and-forget
  }
}
