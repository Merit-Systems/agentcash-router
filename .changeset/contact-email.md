---
"@agentcash/router": minor
---

Add optional `email` to `discovery.contact`. It is published verbatim in the generated OpenAPI `info.contact.email`, letting origins expose a contact address for ownership verification, user contact, and merchant-page customization (e.g. on Poncho). Omit it to keep the existing behavior.
