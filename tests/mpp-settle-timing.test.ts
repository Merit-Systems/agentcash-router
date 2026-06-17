import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { RouteEntry } from '../src/types.js';
import type { VerifyArgs } from '../src/protocols/types.js';
import * as transactionMode from '../src/protocols/mpp/transaction-mode.js';
import * as hashMode from '../src/protocols/mpp/hash-mode.js';
import * as credential from '../src/protocols/mpp/credential.js';
import { mppStrategy } from '../src/protocols/mpp/strategy.js';

const transactionInfo = {
  credential: {} as credential.MppCredentialInfo['credential'],
  wallet: '0xabc',
  payloadType: 'transaction' as const,
};

const txVerifySuccess = {
  ok: true as const,
  wallet: '0xabc',
  payment: {
    protocol: 'mpp' as const,
    status: 'verified' as const,
    payer: '0xabc',
    amount: '0.01',
    network: 'tempo:4217',
  },
  token: { mode: 'transaction' as const, credential: transactionInfo.credential },
  alreadySettled: false,
};

const hashVerifySuccess = {
  ok: true as const,
  wallet: '0xabc',
  payment: {
    protocol: 'mpp' as const,
    status: 'settled' as const,
    payer: '0xabc',
    amount: '0.01',
    network: 'tempo:4217',
  },
  token: { mode: 'hash' as const, charge: {} },
  alreadySettled: true,
};

function makeVerifyArgs(settleBeforeHandler: boolean | undefined): VerifyArgs {
  return {
    request: new Request('https://example.com/api/test', { method: 'POST' }),
    body: {},
    price: '0.01',
    routeEntry: {
      key: 'test',
      authMode: 'paid',
      billing: 'exact',
      protocols: ['mpp'],
      mppInfo: settleBeforeHandler ? { settleBeforeHandler: true } : undefined,
    },
    deps: {
      tempoClient: {},
      payeeAddress: '0xpayee',
      mppx: { charge: vi.fn() },
    } as VerifyArgs['deps'],
    report: vi.fn(),
  };
}

describe('mppStrategy.verify mpp.settleBeforeHandler', () => {
  beforeEach(() => {
    vi.spyOn(credential, 'readMppCredential').mockReturnValue(transactionInfo);
    vi.spyOn(transactionMode, 'verifyTxMode').mockResolvedValue(txVerifySuccess);
    vi.spyOn(hashMode, 'verifyHashMode').mockResolvedValue(hashVerifySuccess);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('defers MPP transaction broadcast by default', async () => {
    await mppStrategy.verify(makeVerifyArgs(undefined));

    expect(transactionMode.verifyTxMode).toHaveBeenCalledOnce();
    expect(hashMode.verifyHashMode).not.toHaveBeenCalled();
  });

  it('broadcasts MPP transaction payment at verify when mpp.settleBeforeHandler is set', async () => {
    await mppStrategy.verify(makeVerifyArgs(true));

    expect(hashMode.verifyHashMode).toHaveBeenCalledOnce();
    expect(transactionMode.verifyTxMode).not.toHaveBeenCalled();
  });
});
