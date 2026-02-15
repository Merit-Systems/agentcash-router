import type { RouteEntry } from '../types.js';

// MPP (Micropayment Protocol) wrappers using mpay primitives.
// mpay is an optional peer dep — lazily loaded.

let mpayLoaded = false;
/* eslint-disable @typescript-eslint/no-explicit-any -- mpay module vars are used dynamically */
let Challenge: any;
let Credential: any;
let Receipt: any;
let tempo: any;
let viemCreateClient: any;
let viemHttp: any;
let tempoChain: any;
/* eslint-enable @typescript-eslint/no-explicit-any */

async function ensureMpay() {
  if (mpayLoaded) return;
  try {
    const mpay = await import('mpay');
    Challenge = mpay.Challenge;
    Credential = mpay.Credential;
    Receipt = mpay.Receipt;
    const mpayServer = await import('mpay/server');
    tempo = mpayServer.tempo;
    // viem is a transitive dep of mpay — always available when mpay is installed.
    // Loaded eagerly so getClient can be synchronous (mpay requires sync getClient).
    const viem = await import('viem');
    viemCreateClient = viem.createClient;
    viemHttp = viem.http;
    const viemChains = await import('viem/chains');
    tempoChain = viemChains.tempo;
    mpayLoaded = true;
  } catch {
    throw new Error('mpay package is required for MPP protocol support. Install it: pnpm add mpay');
  }
}

/**
 * Builds getClient option for tempo.charge() when an RPC URL is available.
 * Falls back to TEMPO_RPC_URL env var. Returns empty object if neither is set
 * (lets mpay use its default, which may require auth).
 */
function buildGetClient(rpcUrl?: string): Record<string, unknown> {
  const url = rpcUrl ?? process.env.TEMPO_RPC_URL;
  if (!url) return {};
  return {
    getClient: () => viemCreateClient({ chain: tempoChain, transport: viemHttp(url) }),
  };
}

/**
 * Converts NextRequest to standard Web API Request.
 * NextRequest extends Request but has subtle header handling differences
 * that break mpay's Credential.fromRequest(). This ensures compatibility.
 */
function toStandardRequest(request: Request): Request {
  // If already standard Request, return as-is
  if (request.constructor.name === 'Request') {
    return request;
  }

  // Create new standard Request with same properties
  return new Request(request.url, {
    method: request.method,
    headers: request.headers,
    body: request.body,
    // @ts-expect-error - Request.duplex is required for streaming bodies but not in types yet
    duplex: 'half',
  });
}

export async function buildMPPChallenge(
  routeEntry: RouteEntry,
  request: Request,
  mppConfig: { secretKey: string; currency: string; recipient?: string; rpcUrl?: string },
  price: string,
) {
  await ensureMpay();

  // Convert NextRequest to standard Request for mpay compatibility
  const standardRequest = toStandardRequest(request);

  // Create a MethodIntent to define payment requirements (tempo.charge for one-time payments).
  // This sets up the schema and defaults (decimals, expires) for the payment method.
  const methodIntent = tempo.charge({
    currency: mppConfig.currency,
    recipient: mppConfig.recipient ?? '',
  });

  // Build challenge using payment request data (NOT the HTTP Request object).
  // The 'request' field here is the payment data that will be sent to the client.
  const challenge = Challenge.fromIntent(methodIntent, {
    secretKey: mppConfig.secretKey,
    realm: new URL(standardRequest.url).origin,
    request: {
      amount: price,
      currency: mppConfig.currency,
      recipient: mppConfig.recipient ?? '',
      // decimals and expires are auto-populated by tempo.charge defaults
    },
  });

  return Challenge.serialize(challenge) as string;
}

export async function verifyMPPCredential(
  request: Request,
  _routeEntry: RouteEntry,
  mppConfig: { secretKey: string; currency: string; recipient?: string; rpcUrl?: string },
  price: string,
) {
  await ensureMpay();

  // Convert NextRequest to standard Request for mpay compatibility
  const standardRequest = toStandardRequest(request);

  try {
    const authHeader = standardRequest.headers.get('Authorization');
    if (!authHeader) {
      console.error('[MPP] No Authorization header found');
      return null;
    }

    // Extract credential using mpay's standard method
    let credential;
    try {
      credential = Credential.fromRequest(standardRequest);
    } catch (fromRequestError) {
      console.error('[MPP] Failed to extract credential:', fromRequestError instanceof Error ? fromRequestError.message : String(fromRequestError));
      return null;
    }

    if (!credential || !credential.challenge) {
      console.error('[MPP] Invalid credential structure');
      return null;
    }

    // Verify challenge HMAC (stateless). Challenge.verify expects a Challenge
    // object (accesses .id for HMAC check), not the full Credential wrapper.
    const isValid = Challenge.verify(credential.challenge, { secretKey: mppConfig.secretKey });
    if (!isValid) {
      console.error('[MPP] Challenge HMAC verification failed');
      return { valid: false as const, payer: null };
    }

    // Verify on-chain via Tempo.
    // tempo.charge() returns a MethodIntent server object whose verify()
    // expects { credential, request } — matching the high-level Mpay.create() convention.
    // The request() transform resolves chainId/feePayer before verify() checks on-chain.
    const methodIntent = tempo.charge({
      currency: mppConfig.currency,
      recipient: mppConfig.recipient ?? '',
      ...buildGetClient(mppConfig.rpcUrl),
    });

    const paymentRequest = { amount: price, currency: mppConfig.currency, recipient: mppConfig.recipient ?? '' };
    const resolvedRequest = methodIntent.request
      ? await methodIntent.request({ credential, request: paymentRequest })
      : paymentRequest;

    // verify() returns a receipt { method, status, reference } on success, throws on failure.
    const receipt = await methodIntent.verify({ credential, request: resolvedRequest });
    if (!receipt || receipt.status !== 'success') {
      console.error('[MPP] Tempo verification failed:', receipt);
      return { valid: false as const, payer: null };
    }

    // Payer address: extract from credential's challenge request or payload.
    // The credential embeds the sender who signed the payment transaction.
    const payer = credential.payload?.from ?? credential.challenge?.request?.from ?? receipt.reference ?? '';

    return {
      valid: true as const,
      payer: payer as string,
      txHash: receipt.reference as string,
    };
  } catch (error) {
    console.error('[MPP] Credential verification error:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      errorType: error?.constructor?.name,
    });
    return null;
  }
}

export async function buildMPPReceipt(reference: string) {
  await ensureMpay();

  const receipt = Receipt.from({
    method: 'tempo',
    status: 'success',
    reference,
    timestamp: new Date().toISOString(),
  });

  return Receipt.serialize(receipt) as string;
}
