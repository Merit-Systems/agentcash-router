---
"@agentcash/router": patch
---

fix(registry): include HTTP method in registry map key so POST and DELETE on the same path coexist

Previously both methods shared the same key (e.g. `site/domain`), causing the second registration to silently overwrite the first. Only the last-registered method appeared in the OpenAPI spec and well-known discovery. The internal map key is now `{key}:{method}` — same-path-same-method double registration (expected during Next.js build for discovery stubs) still last-write-wins.
