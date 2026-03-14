---
'@agentcash/router': patch
---

Fix Bazaar schema generation failing silently for Zod schemas that use `.transform()` or `.refine()`.

- Pass `unrepresentable: 'any'` to `z.toJSONSchema()` so untranslatable fields emit `{}` instead of throwing
- Replace silent `catch {}` with `onAlert('warn')` so operators see failures in telemetry
