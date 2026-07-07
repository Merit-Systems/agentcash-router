import { describe, expect, it, vi } from 'vitest';
import { decodePaymentRequiredHeader } from '@x402/core/http';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import { UptoEvmScheme } from '@x402/evm/upto/client';
import { createRequestHandler, type RouterDeps } from '../src/pipeline/orchestrate.js';
import { MemoryNonceStore, MemoryEntitlementStore } from '../src/kv-store/index.js';
import { makeTestAgentIdentityNonceStore } from './fakes/agent-identity-deps.js';
import { FakeX402Server, KNOWN_PAYEE } from './fakes/x402-server.js';
import type { RouteEntry } from '../src/types.js';
import type { ResolvedX402Facilitator } from '../src/protocols/x402/facilitators.js';
import type { PaymentRequirements } from '@x402/core/types';

const BASE_MAINNET_NETWORK = 'eip155:8453';
const BASE_USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const PERMIT2_ADDRESS = '0x000000000022D473030F116dDEE9F6B43aC78BA3';
const FORTUNE_LLM_URL = 'http://localhost:3000/api/fortune/llm';

function makeFortuneLlmEntry(): RouteEntry {
  return {
    key: 'fortune/llm',
    authMode: 'paid',
    pricing: '0.01',
    protocols: ['x402'],
    method: 'POST',
    billing: 'upto',
    maxPrice: '0.01',
    unitType: 'request',
  };
}

function makeFacilitator(network: string, url: string): ResolvedX402Facilitator {
  return {
    family: 'evm',
    network: network as ResolvedX402Facilitator['network'],
    url,
    config: { url },
  };
}

function makeDeps(server: FakeX402Server, accepts: RouterDeps['x402Accepts']): RouterDeps {
  return {
    x402Server: server as unknown as RouterDeps['x402Server'],
    initPromise: Promise.resolve(),
    nonceStore: new MemoryNonceStore(),
    agentIdentityNonceStore: makeTestAgentIdentityNonceStore(),
    entitlementStore: new MemoryEntitlementStore(),
    payeeAddress: KNOWN_PAYEE,
    network: BASE_MAINNET_NETWORK,
    x402FacilitatorsByNetwork: {
      [BASE_MAINNET_NETWORK]: makeFacilitator(BASE_MAINNET_NETWORK, 'https://cdp.example'),
    },
    x402Accepts: accepts,
  };
}

describe('upto + EIP-2612 gas sponsoring on fortune/llm', () => {
  it('declares eip2612GasSponsoring in the 402 challenge extensions', async () => {
    const server = new FakeX402Server();
    const deps = makeDeps(server, [
      {
        scheme: 'upto',
        network: BASE_MAINNET_NETWORK,
        payTo: KNOWN_PAYEE,
        asset: BASE_USDC,
        decimals: 6,
        maxTimeoutSeconds: 300,
      },
    ]);

    const handler = createRequestHandler(makeFortuneLlmEntry(), async () => ({ ok: true }), deps);
    const response = await handler(new Request(FORTUNE_LLM_URL, { method: 'POST' }));

    expect(response.status).toBe(402);
    const challenge = decodePaymentRequiredHeader(response.headers.get('PAYMENT-REQUIRED')!);

    const uptoAccept = challenge.accepts.find((a) => a.scheme === 'upto');
    expect(uptoAccept).toBeDefined();
    expect(uptoAccept!.network).toBe(BASE_MAINNET_NETWORK);

    const extensions = (challenge as unknown as { extensions?: Record<string, unknown> })
      .extensions;
    expect(extensions).toBeDefined();
    const ext = extensions!.eip2612GasSponsoring as
      | { info?: { description?: string; version?: string }; schema?: Record<string, unknown> }
      | undefined;
    expect(ext).toBeDefined();
    expect(ext!.info?.version).toBe('1');
    expect(typeof ext!.info?.description).toBe('string');
    expect(ext!.schema).toBeDefined();
    const required = (ext!.schema as { required?: string[] }).required ?? [];
    expect(required).toEqual(
      expect.arrayContaining([
        'from',
        'asset',
        'spender',
        'amount',
        'nonce',
        'deadline',
        'signature',
        'version',
      ]),
    );
  });

  it('omits eip2612GasSponsoring when the route has no upto accept', async () => {
    const server = new FakeX402Server();
    const deps = makeDeps(server, [
      { scheme: 'exact', network: BASE_MAINNET_NETWORK, payTo: KNOWN_PAYEE },
    ]);

    const entry: RouteEntry = {
      key: 'fortune/premium',
      authMode: 'paid',
      billing: 'exact',
      pricing: '0.005',
      protocols: ['x402'],
      method: 'POST',
    };
    const handler = createRequestHandler(entry, async () => ({ ok: true }), deps);
    const response = await handler(
      new Request('http://localhost:3000/api/fortune/premium', { method: 'POST' }),
    );

    expect(response.status).toBe(402);
    const challenge = decodePaymentRequiredHeader(response.headers.get('PAYMENT-REQUIRED')!);
    const extensions = (challenge as unknown as { extensions?: Record<string, unknown> })
      .extensions;
    if (extensions) {
      expect(extensions.eip2612GasSponsoring).toBeUndefined();
    }
  });

  it('client signs an off-chain EIP-2612 permit with no on-chain approve', async () => {
    // Reconstruct a Base mainnet upto requirement enriched with the USDC
    // EIP-712 domain (name/version) that the real UptoEvmScheme server stamps
    // via getDefaultAsset — the fake omits it, so populate it explicitly.
    const validPayee = '0x0000000000000000000000000000000000000001';
    const requirements: PaymentRequirements = {
      scheme: 'upto',
      network: BASE_MAINNET_NETWORK,
      maxAmountRequired: '10000',
      amount: '10000',
      resource: 'http://localhost:3000/api/fortune/llm',
      description: 'fortune/llm',
      mimeType: 'application/json',
      payTo: validPayee,
      asset: BASE_USDC,
      maxTimeoutSeconds: 300,
      extra: {
        name: 'USD Coin',
        version: '2',
        assetTransferMethod: 'permit2',
        // Required by createUptoPermit2Payload (Permit2Proxy spender). Stand-in
        // for what the real CDP-backed UptoEvmScheme server stamps via getExtra().
        facilitatorAddress: '0x000000000000000000000000000000000000fAcE',
      },
    } as unknown as PaymentRequirements;

    const account = privateKeyToAccount(generatePrivateKey());

    const readContract = vi.fn(async (args: { functionName: string }) => {
      if (args.functionName === 'allowance') return 0n;
      if (args.functionName === 'nonces') return 0n;
      throw new Error(`unexpected readContract call: ${args.functionName}`);
    });
    const signTypedDataSpy = vi.fn(async (msg: { primaryType: string }) => {
      expect(msg.primaryType).toBe('Permit');
      return ('0x' + '11'.repeat(64) + '1b') as `0x${string}`;
    });
    const signTransaction = vi.fn(async () => {
      throw new Error('on-chain signTransaction must not be called for EIP-2612 path');
    });

    const signer = {
      address: account.address,
      // PermitTransferFrom signature is signed by the real account; this also
      // fulfills the Permit2 signature for the upto payload. The Permit primaryType
      // is captured by signTypedDataSpy above.
      signTypedData: async (msg: {
        domain: Record<string, unknown>;
        types: Record<string, unknown>;
        primaryType: string;
        message: Record<string, unknown>;
      }) => {
        if (msg.primaryType === 'Permit') {
          return signTypedDataSpy(msg);
        }
        return account.signTypedData(msg as unknown as Parameters<typeof account.signTypedData>[0]);
      },
      readContract,
      signTransaction,
    };

    const client = new UptoEvmScheme(signer);
    const result = await client.createPaymentPayload(2, requirements, {
      extensions: { eip2612GasSponsoring: { info: { description: 'x', version: '1' } } },
    } as unknown as Parameters<typeof client.createPaymentPayload>[2]);

    expect(signTransaction).not.toHaveBeenCalled();
    expect(signTypedDataSpy).toHaveBeenCalled();

    const exts = (result as { extensions?: Record<string, unknown> }).extensions;
    expect(exts).toBeDefined();
    const permit = exts!.eip2612GasSponsoring as
      | {
          info?: {
            from?: string;
            asset?: string;
            spender?: string;
            amount?: string;
            nonce?: string;
            deadline?: string;
            signature?: string;
            version?: string;
          };
        }
      | undefined;
    expect(permit?.info).toBeDefined();
    expect(permit!.info!.from?.toLowerCase()).toBe(account.address.toLowerCase());
    expect(permit!.info!.asset?.toLowerCase()).toBe(BASE_USDC.toLowerCase());
    expect(permit!.info!.spender?.toLowerCase()).toBe(PERMIT2_ADDRESS.toLowerCase());
    expect(permit!.info!.signature).toMatch(/^0x[0-9a-fA-F]+$/);
    expect(permit!.info!.amount).toBeDefined();
    expect(permit!.info!.nonce).toBe('0');
    expect(permit!.info!.deadline).toBeDefined();
    expect(permit!.info!.version).toBeDefined();
  });
});
