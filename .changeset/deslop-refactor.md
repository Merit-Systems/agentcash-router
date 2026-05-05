---
"@agentcash/router": patch
---

Internal refactor: split `orchestrate.ts` (~1525 lines), `protocols/x402.ts` (~398 lines), and `pricing.ts` into focused per-concern modules. No public API or behavior changes.

- `orchestrate.ts` is now a thin dispatcher into per-authMode flows under `src/pipeline/flows/` (`paid`, `siwx-only`, `api-key-only`, `unprotected`), with each pipeline step extracted into single-purpose helpers under `src/pipeline/context/`.
- `protocols/x402.ts` and `protocols/mpp-siwx.ts` reorganized into `src/protocols/x402/` and `src/protocols/mpp/`, each with a `strategy.ts` entry point and dedicated verify/settle/challenge submodules.
- `pricing.ts` split into `src/pricing/{fixed,tiered,dynamic,types,index}.ts`.
- Removed unused `src/client/index.ts` (162 lines).
- New `src/headers.ts` for shared header helpers.
