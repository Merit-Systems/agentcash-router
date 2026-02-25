---
'@agentcash/router': patch
---

Normalize MPP credential source DID to plain address. MPP credentials use `did:pkh:eip155:<chainId>:<address>` format, but SIWX and x402 return plain `0x...` addresses. Without normalization, jobs created via MPP can't be fetched via SIWX because the wallet strings don't match.
