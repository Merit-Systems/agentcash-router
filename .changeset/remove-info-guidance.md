---
"@agentcash/router": minor
---

Remove the non-spec `info.guidance` key from OpenAPI output. Guidance is now exposed only via the spec-compliant `info.x-guidance` extension (plus `/llms.txt` and the well-known `instructions` field). Consumers reading `info.guidance` should switch to `info["x-guidance"]`.
