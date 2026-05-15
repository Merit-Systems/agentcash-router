import { describe, expect, it } from 'vitest';
import type { FacilitatorClient, FacilitatorConfig } from '@x402/core/http';
import type { SupportedResponse } from '@x402/core/types';
import { createFacilitatorClients } from '../src/protocols/x402/facilitator-clients.js';
import type { ResolvedX402Facilitators } from '../src/protocols/x402/facilitators.js';

const SOLANA_NETWORK = 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp';
const EVM_NETWORK = 'eip155:8453';

function fakeHttpFacilitator(
  supportedByUrl: Record<string, SupportedResponse>,
): new (config?: FacilitatorConfig) => FacilitatorClient {
  return class implements FacilitatorClient {
    private readonly url: string;
    constructor(config?: FacilitatorConfig) {
      this.url = (config?.url ?? '').replace(/\/+$/, '');
    }
    verify: FacilitatorClient['verify'] = async () => {
      throw new Error('verify not used in this test');
    };
    settle: FacilitatorClient['settle'] = async () => {
      throw new Error('settle not used in this test');
    };
    getSupported: FacilitatorClient['getSupported'] = async () => {
      const found = supportedByUrl[this.url];
      if (!found) throw new Error(`no stub /supported for ${this.url}`);
      return found;
    };
  };
}

describe('createFacilitatorClients', () => {
  it("scopes an EVM facilitator's getSupported kinds to its declared networks, even when /supported claims more", async () => {
    const cdpUrl = 'https://cdp.example';
    const corbitsUrl = 'https://corbits.example';

    const facilitatorsByNetwork: ResolvedX402Facilitators = {
      [EVM_NETWORK]: {
        family: 'evm',
        network: EVM_NETWORK,
        url: cdpUrl,
        config: { url: cdpUrl },
      },
      [SOLANA_NETWORK]: {
        family: 'solana',
        network: SOLANA_NETWORK,
        url: corbitsUrl,
        config: { url: corbitsUrl },
      },
    };

    const HTTP = fakeHttpFacilitator({
      [cdpUrl]: {
        kinds: [
          { x402Version: 2, scheme: 'exact', network: EVM_NETWORK },
          { x402Version: 2, scheme: 'upto', network: EVM_NETWORK },
          // The poaching kinds: CDP's live response claiming Solana too.
          { x402Version: 2, scheme: 'exact', network: SOLANA_NETWORK },
        ],
        extensions: ['eip2612GasSponsoring'],
        signers: { [EVM_NETWORK]: ['0xCdpSigner'] },
      },
      [corbitsUrl]: {
        kinds: [{ x402Version: 2, scheme: 'exact', network: SOLANA_NETWORK }],
        extensions: [],
        signers: {},
      },
    });

    const [evmClient, solanaClient] = createFacilitatorClients(
      facilitatorsByNetwork,
      HTTP,
      undefined,
    );

    const evmSupported = await evmClient.getSupported();
    expect(evmSupported.kinds.map((k) => k.network)).toEqual([EVM_NETWORK, EVM_NETWORK]);
    expect(evmSupported.kinds.some((k) => k.network === SOLANA_NETWORK)).toBe(false);
    // extensions/signers from the live response must still flow through (upto
    // depends on facilitator-provided signers for Permit2 witness signing).
    expect(evmSupported.extensions).toEqual(['eip2612GasSponsoring']);
    expect(evmSupported.signers).toEqual({ [EVM_NETWORK]: ['0xCdpSigner'] });

    const solanaSupported = await solanaClient.getSupported();
    expect(solanaSupported.kinds.map((k) => k.network)).toEqual([SOLANA_NETWORK]);
    expect(solanaSupported.kinds.every((k) => k.scheme === 'exact')).toBe(true);
  });

  it("merges the facilitator's per-kind extra into the scoped upto kind", async () => {
    const cdpUrl = 'https://cdp.example';

    const facilitatorsByNetwork: ResolvedX402Facilitators = {
      [EVM_NETWORK]: {
        family: 'evm',
        network: EVM_NETWORK,
        url: cdpUrl,
        config: { url: cdpUrl },
      },
    };

    const HTTP = fakeHttpFacilitator({
      [cdpUrl]: {
        kinds: [
          { x402Version: 2, scheme: 'exact', network: EVM_NETWORK },
          {
            x402Version: 2,
            scheme: 'upto',
            network: EVM_NETWORK,
            extra: { facilitatorAddress: '0xFacilitator' },
          },
        ],
        extensions: [],
        signers: {},
      },
    });

    const [evmClient] = createFacilitatorClients(facilitatorsByNetwork, HTTP, undefined);

    const supported = await evmClient.getSupported();
    const uptoKind = supported.kinds.find((k) => k.scheme === 'upto');
    // The upto scheme needs facilitatorAddress in extra; scoping must not drop it.
    expect(uptoKind?.extra).toEqual({ facilitatorAddress: '0xFacilitator' });
    const exactKind = supported.kinds.find((k) => k.scheme === 'exact');
    expect(exactKind?.extra).toBeUndefined();
  });
});
