import type { RouteEntry } from '../types.js';

// MPP (Micropayment Protocol) wrappers using mpay primitives.
// mpay is an optional peer dep — lazily loaded.

let mpayLoaded = false;
/* eslint-disable @typescript-eslint/no-explicit-any -- mpay module vars are used dynamically */
let Challenge: any;
let Credential: any;
let Receipt: any;
let tempo: any;
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
    realm: new URL(request.url).origin,
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
  mppConfig: { secretKey: string; currency: string; recipient?: string },
  price: string,
) {
  await ensureMpay();

  const credential = Credential.fromRequest(request);
  if (!credential) return null;

  // Verify challenge HMAC (stateless). Challenge.verify expects a Challenge
  // object (accesses .id for HMAC check), not the full Credential wrapper.
  const isValid = Challenge.verify(credential.challenge, { secretKey: mppConfig.secretKey });
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
    timestamp: new Date().toISOString(),
  });

  return Receipt.serialize(receipt) as string;
}
