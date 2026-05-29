---
"@agentcash/router": patch
---

Make `TEMPO_RPC_URL` optional and default it to the public Tempo endpoint (`https://rpc.tempo.xyz`).

The config previously treated `TEMPO_RPC_URL` as a hard requirement whenever MPP was enabled, failing with `missing_mpp_rpc_url`, and the docs/messages claimed the public `rpc.tempo.xyz` returns 401. That claim is false — the public endpoint returns 200 with valid JSON-RPC responses (verified against `eth_chainId`/`eth_blockNumber`, including under rapid-fire requests). Requiring an authenticated URL was unnecessary friction.

`TEMPO_RPC_URL` is now optional. When neither `mpp.rpcUrl` nor `TEMPO_RPC_URL` is set, the router falls back to the new exported `DEFAULT_TEMPO_RPC_URL` constant. Override it only if you have a dedicated endpoint.

- Added and exported `DEFAULT_TEMPO_RPC_URL` (`https://rpc.tempo.xyz`).
- Removed the `missing_mpp_rpc_url` config error (and the now-dead issue code from `RouterConfigIssue`'s code union). A `TEMPO_RPC_URL` that *is* provided is still validated as a URL (`invalid_mpp_rpc_url`).
- Updated README, the Vercel deploy example, and all messages/comments to drop the inaccurate 401 framing.
