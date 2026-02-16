import { Challenge, Credential, Receipt } from 'mppx';
import type { Credential as CredentialType, Challenge as ChallengeType } from 'mppx';
import { tempo } from 'mppx/server';
import { createClient, http } from 'viem';
import { tempo as tempoChain } from 'viem/chains';
import type { RouteEntry } from '../types.js';

/** Tempo charge credential payload — discriminated union on `type`. */
type TempoChargePayload =
  | { hash: string; type: 'hash' }
  | { signature: string; type: 'transaction' };

/**
 * Tempo charge request shape (output of the charge request schema after Zod transform).
 * The `OutputRequestType` utility in mppx merges methodDetails into the base,
 * making all fields required (some as `string | undefined`).
 * `recipient` becomes required `string` (not `string | undefined`) because
 * the method schema's `requires` tuple includes it.
 */
type TempoChargeRequest = {
  amount: string;
  currency: string;
  decimals: number;
  expires: string;
  description: string | undefined;
  externalId: string | undefined;
  recipient: string;
};

/** Fully-typed credential for tempo charge method. */
type TempoChargeCredential = CredentialType.Credential<
  TempoChargePayload,
  ChallengeType.Challenge<TempoChargeRequest, 'charge', 'tempo'>
>;

/**
 * Builds getClient option for tempo.charge() when an RPC URL is available.
 * Falls back to TEMPO_RPC_URL env var. Returns empty object if neither is set
 * (lets mppx use its default, which may require auth).
 */
function buildGetClient(rpcUrl?: string): Record<string, unknown> {
  const url = rpcUrl ?? process.env.TEMPO_RPC_URL;
  if (!url) return {};
  return {
    getClient: () => createClient({ chain: tempoChain, transport: http(url) }),
  };
}

/**
 * Converts NextRequest to standard Web API Request.
 * NextRequest extends Request but has subtle header handling differences
 * that break mppx's Credential.fromRequest(). This ensures compatibility.
 *
 * NOTE: Body is intentionally omitted. By the time verifyMPPCredential() is
 * called, orchestrate.ts has already consumed the body stream via parseBody().
 * MPP verification only needs headers (Authorization), so this is safe.
 * See tests/mpp-body-bug.test.ts for the full explanation.
 */
function toStandardRequest(request: Request): Request {
  // If already standard Request, return as-is
  if (request.constructor.name === 'Request') {
    return request;
  }

  // Create new standard Request with headers only.
  // Body is not included because:
  // 1. MPP only reads the Authorization header
  // 2. The body stream is already consumed by parseBody() in orchestrate.ts
  return new Request(request.url, {
    method: request.method,
    headers: request.headers,
  });
}

/** Default decimals for USDC/stablecoin payments on Tempo. */
const DEFAULT_DECIMALS = 6;

export async function buildMPPChallenge(
  routeEntry: RouteEntry,
  request: Request,
  mppConfig: { secretKey: string; currency: string; recipient?: string; rpcUrl?: string },
  price: string,
) {
  // Convert NextRequest to standard Request for mppx compatibility
  const standardRequest = toStandardRequest(request);

  const currency = mppConfig.currency as `0x${string}`;
  const recipient = (mppConfig.recipient ?? '') as `0x${string}`;

  // Create a MethodIntent to define payment requirements (tempo.charge for one-time payments).
  // In mppx, currency/recipient are passed in the request object, not in the constructor.
  const methodIntent = tempo.charge();

  // Build challenge using payment request data (NOT the HTTP Request object).
  // The 'request' field here is the payment data that will be sent to the client.
  const challenge = Challenge.fromIntent(methodIntent, {
    secretKey: mppConfig.secretKey,
    realm: new URL(standardRequest.url).origin,
    request: {
      amount: price,
      currency,
      recipient,
      decimals: DEFAULT_DECIMALS,
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
  // Convert NextRequest to standard Request for mppx compatibility
  const standardRequest = toStandardRequest(request);

  const currency = mppConfig.currency as `0x${string}`;
  const recipient = (mppConfig.recipient ?? '') as `0x${string}`;

  try {
    const authHeader = standardRequest.headers.get('Authorization');
    if (!authHeader) {
      console.error('[MPP] No Authorization header found');
      return null;
    }

    // Credential.fromRequest deserializes from the opaque Authorization header, so it can't
    // infer the challenge schema. We assert the full tempo charge credential type at this
    // deserialization boundary — the HMAC + on-chain verify below confirm it's actually valid.
    const credential = Credential.fromRequest(standardRequest) as TempoChargeCredential;

    if (!credential?.challenge) {
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
    // tempo.charge() returns a MethodIntent.Server whose verify()
    // expects { credential, request } and handles chain resolution internally.
    const methodIntent = tempo.charge({
      ...buildGetClient(mppConfig.rpcUrl),
    });

    const paymentRequest = {
      amount: price,
      currency,
      recipient,
      decimals: DEFAULT_DECIMALS,
    };

    // verify() returns a receipt { method, status, reference } on success, throws on failure.
    const receipt = await methodIntent.verify({
      credential,
      request: paymentRequest,
    });
    if (!receipt || receipt.status !== 'success') {
      console.error('[MPP] Tempo verification failed:', receipt);
      return { valid: false as const, payer: null };
    }

    // Payer address lives in the receipt reference (tx hash).
    const payer = receipt.reference ?? '';

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

export function buildMPPReceipt(reference: string) {
  const receipt = Receipt.from({
    method: 'tempo',
    status: 'success',
    reference,
    timestamp: new Date().toISOString(),
  });

  return Receipt.serialize(receipt) as string;
}
