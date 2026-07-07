import {
  createChallenge,
  isIdentityError,
  verifySignature,
  type Challenge,
  type NonceStoreInterface,
} from 'did-auth-challenge';
import { HEADERS } from '../headers.js';
import { HttpError } from '../types.js';

const PROTOCOL_VERSION = 1;

interface AgentIdentityChallengeEnvelope {
  v: number;
  challenge: Challenge;
}

interface AgentIdentityProofEnvelope extends AgentIdentityChallengeEnvelope {
  did: string;
  signature: string;
  authenticationKey?: string;
}

function base64urlEncode(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function base64urlDecode<T>(value: string): T {
  return JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as T;
}

function challengeBindings(request: Request): { domain: string; route: string } {
  const url = new URL(request.url);
  return { domain: url.hostname, route: url.pathname };
}

export async function buildAgentIdentityChallengeHeader(
  request: Request,
  nonceStore: NonceStoreInterface,
): Promise<string> {
  const bindings = challengeBindings(request);
  const challenge = await createChallenge(bindings, { nonceStore });
  return base64urlEncode({
    v: PROTOCOL_VERSION,
    challenge,
  } satisfies AgentIdentityChallengeEnvelope);
}

export async function attachAgentIdentityChallenge(
  response: Response,
  request: Request,
  nonceStore: NonceStoreInterface,
): Promise<void> {
  response.headers.set(
    HEADERS.AGENT_IDENTITY,
    await buildAgentIdentityChallengeHeader(request, nonceStore),
  );
}

export async function resolveActor(
  request: Request,
  nonceStore: NonceStoreInterface,
): Promise<string | null> {
  const header = request.headers.get(HEADERS.AGENT_IDENTITY);
  if (!header) return null;

  let envelope: AgentIdentityProofEnvelope;
  try {
    envelope = base64urlDecode<AgentIdentityProofEnvelope>(header);
  } catch {
    throw new HttpError('Malformed X-Agent-Identity header', 401);
  }

  if (
    envelope.v !== PROTOCOL_VERSION ||
    !envelope.challenge ||
    !envelope.did ||
    !envelope.signature
  ) {
    throw new HttpError('Invalid X-Agent-Identity proof', 401);
  }

  const bindings = challengeBindings(request);

  try {
    await verifySignature({
      did: envelope.did,
      authenticationKey: envelope.authenticationKey,
      challenge: envelope.challenge,
      signature: envelope.signature,
      options: {
        nonceStore,
        expected: bindings,
      },
    });
  } catch (err) {
    const message = isIdentityError(err) ? err.code : 'Invalid agent identity';
    throw new HttpError(message, 401);
  }

  return envelope.did;
}
