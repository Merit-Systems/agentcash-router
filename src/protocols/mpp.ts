import type { RouteEntry } from '../types.js';

// MPP (Micropayment Protocol) wrappers using mpay primitives.
// mpay is an optional peer dep — lazily loaded.

let mpayLoaded = false;
let Challenge: Record<string, Function>;
let Credential: Record<string, Function>;
let Receipt: Record<string, Function>;
let tempo: Record<string, Function>;

async function ensureMpay() {
  if (mpayLoaded) return;
  try {
    const mpay = await import('mpay');
    Challenge = mpay.Challenge;
    Credential = mpay.Credential;
    Receipt = mpay.Receipt;
    const mpayServer = await import('mpay/server');
    tempo = mpayServer.tempo;
    mpayLoaded = true;
  } catch {
    throw new Error('mpay package is required for MPP protocol support. Install it: pnpm add mpay');
  }
}

export async function buildMPPChallenge(
  routeEntry: RouteEntry,
  request: Request,
  mppConfig: { secretKey: string; currency: string; recipient?: string },
  price: string,
) {
  await ensureMpay();

  const intent = {
    amount: price,
    currency: mppConfig.currency,
    recipient: mppConfig.recipient ?? '',
  };

  const challenge = Challenge.fromIntent(intent, {
    secretKey: mppConfig.secretKey,
    realm: new URL(request.url).origin,
    request,
  });

  return Challenge.serialize(challenge) as string;
}

export async function verifyMPPCredential(
  request: Request,
  _routeEntry: RouteEntry,
  mppConfig: { secretKey: string; currency: string; recipient?: string },
  price: string,
) {
  await ensureMpay();

  const credential = Credential.fromRequest(request);
  if (!credential) return null;

  // Verify challenge HMAC (stateless)
  const isValid = Challenge.verify(credential, { secretKey: mppConfig.secretKey });
  if (!isValid) {
    return { valid: false as const, payer: null };
  }

  // Verify on-chain via Tempo
  const chargeConfig = {
    amount: price,
    currency: mppConfig.currency,
    recipient: mppConfig.recipient ?? '',
  };
  const verifyResult = await tempo.charge(chargeConfig).verify(credential);
  if (!verifyResult?.valid) {
    return { valid: false as const, payer: null };
  }

  return {
    valid: true as const,
    payer: verifyResult.payer as string,
  };
}

export async function buildMPPReceipt(reference: string) {
  await ensureMpay();

  const receipt = Receipt.from({
    method: 'tempo',
    status: 'success',
    reference,
    timestamp: Date.now(),
  });

  return Receipt.serialize(receipt) as string;
}
