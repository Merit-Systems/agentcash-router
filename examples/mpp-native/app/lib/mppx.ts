import { createClient, http } from 'viem';
import { tempo as tempoChain } from 'viem/chains';
import { Mppx, tempo } from 'mppx/nextjs';

const rpcUrl = process.env.TEMPO_RPC_URL ?? process.env.RPC_URL;

if (!rpcUrl) {
  console.warn('[mppx] No TEMPO_RPC_URL or RPC_URL set — on-chain verification will fail');
}

export const mppx = Mppx.create({
  methods: [
    tempo({
      currency: '0x20c000000000000000000000b9537d11c60e8b50', // USDC on Tempo mainnet
      recipient: (process.env.MPP_RECIPIENT_ADDRESS ?? '0x0') as `0x${string}`,
      suggestedDeposit: '0.10', // keep escrow small for testing
      getClient: () => {
        if (!rpcUrl) throw new Error('TEMPO_RPC_URL or RPC_URL must be set');
        return createClient({ chain: tempoChain, transport: http(rpcUrl) });
      },
    }),
  ],
});
