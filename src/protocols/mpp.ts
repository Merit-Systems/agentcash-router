import { Mppx } from 'mppx/server';
import { tempo } from 'mppx/server';
import { createClient, http } from 'viem';
import { tempo as tempoChain } from 'viem/chains';

/** Default decimals for USDC/stablecoin payments on Tempo. */
const DEFAULT_DECIMALS = 6;

export type MppConfig = {
  secretKey: string;
  currency: string;
  recipient?: string;
  rpcUrl?: string;
};

/** Function that attaches a Payment-Receipt header to a Response. */
type WithReceiptFn = (response: Response) => Response;

/**
 * Minimal interface for the Mppx instance — hides complex mppx generics
 * that TypeScript cannot serialize across module boundaries.
 */
export interface MppxInstance {
  charge(options: {
    amount: string;
    currency: string;
    recipient: string;
    decimals?: number;
    description?: string;
    expires?: string;
  }): (
    request: Request,
  ) => Promise<{ status: 402; challenge: Response } | { status: 200; withReceipt: WithReceiptFn }>;
}

/**
 * Creates an Mppx instance at router init time.
 *
 * Encapsulates the full challenge → verify → receipt lifecycle so callers
 * only need `mppx.charge(options)(request)`.
 */
export function createMppxInstance(mppConfig: MppConfig): MppxInstance {
  const rpcUrl = mppConfig.rpcUrl ?? process.env.TEMPO_RPC_URL;
  const chargeOptions = rpcUrl
    ? { getClient: () => createClient({ chain: tempoChain, transport: http(rpcUrl) }) }
    : {};

  return Mppx.create({
    methods: [tempo.charge(chargeOptions)],
    secretKey: mppConfig.secretKey,
  }) as unknown as MppxInstance;
}

/**
 * Converts NextRequest to standard Web API Request.
 * NextRequest extends Request but has subtle header handling differences
 * that break mppx's credential parsing. This ensures compatibility.
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

export async function buildMPPChallenge(
  mppx: MppxInstance,
  request: Request,
  mppConfig: MppConfig,
  price: string,
): Promise<string> {
  const result = await mppx.charge({
    amount: price,
    currency: mppConfig.currency,
    recipient: mppConfig.recipient ?? '',
    decimals: DEFAULT_DECIMALS,
  })(toStandardRequest(request));

  if (result.status === 402) {
    return result.challenge.headers.get('WWW-Authenticate')!;
  }
  throw new Error('Expected 402 challenge from mppx');
}

export async function verifyMPPCredential(
  mppx: MppxInstance,
  request: Request,
  mppConfig: MppConfig,
  price: string,
): Promise<{ valid: true; withReceipt: WithReceiptFn } | null> {
  const standardRequest = toStandardRequest(request);

  try {
    const result = await mppx.charge({
      amount: price,
      currency: mppConfig.currency,
      recipient: mppConfig.recipient ?? '',
      decimals: DEFAULT_DECIMALS,
    })(standardRequest);

    if (result.status === 402) return null;

    return {
      valid: true as const,
      withReceipt: result.withReceipt,
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
