import { createClient, http } from 'viem';
import { tempo as tempoChain } from 'viem/chains';
import { Mppx, tempo } from 'mppx/nextjs';
import { privateKeyToAccount } from 'viem/accounts';

const rpcUrl = process.env.TEMPO_RPC_URL ?? process.env.RPC_URL;
if (!rpcUrl) {
  console.warn('[mppx] No TEMPO_RPC_URL or RPC_URL set — on-chain verification will fail');
}

const account = privateKeyToAccount(process.env.MPP_ACCOUNT_KEY as `0x${string}`);
const feePayer = privateKeyToAccount(process.env.MPP_FEE_PAYER_KEY as `0x${string}`);
export const mppx = Mppx.create({
  methods: [
    tempo({
      currency: '0x20c000000000000000000000b9537d11c60e8b50',
      account: feePayer,
      suggestedDeposit: '0.10',
      getClient: () => {
        if (!rpcUrl) throw new Error('TEMPO_RPC_URL or RPC_URL must be set');
        return createClient({ chain: tempoChain, transport: http(rpcUrl) });
      },
      feePayer: true,
    }),
  ],
});
