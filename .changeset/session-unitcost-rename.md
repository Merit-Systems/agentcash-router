---
'@agentcash/router': minor
---

Rename `.metered()` to `.session()` and `tickCost` to `unitCost`, aligning the builder with MPP terminology (the `session` intent prices per-unit `amount` × `unitType`; "tick" was mppx SDK slang). `.metered()` and `tickCost` remain as deprecated aliases with identical behavior and will be removed in a future release. Registration-time and type-level error messages now reference `.session()`/`unitCost`. New exported types: `SessionOptions` (plus `MeteredOptions`/`UpToOptions` are now exported).
