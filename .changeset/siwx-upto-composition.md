---
'@agentcash/router': patch
---

Fix `.upTo().siwx()` composition and reject `.metered().siwx()` at build time.

Previously, `.siwx()` combined with `.upTo()` blew up on the entitlement fast path with `charge is not a function` (issue #257) because the SIWX replay handler context lacked the `charge` field that `.upTo()` handlers expect. Now `invokeUnauthed` injects a no-op `charge` on the SIWX fast path of `.upTo()` routes — preserving the "pay once, replay free with a wallet signature" semantic.

`.metered().siwx()` (per-tick MPP billing + entitlement) is now rejected by the builder in both compose orders — per-tick billing has no coherent entitlement model.
