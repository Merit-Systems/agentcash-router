---
"@agentcash/router": minor
---

Add conditional settlement via `beforeSettle` returning `'skip'`. A paid route can now return its 2xx handler body without charging when the hook returns `'skip'`; `'continue'` or void proceeds to settlement as before, and throw still fails the request without settling.

**Caveat:** `'skip'` only applies to post-handler settlement paths (x402 exact/upto, MPP transaction/pull). MPP hash/push mode settles at verify, before `beforeSettle` runs — `'skip'` cannot un-charge a push-mode client.
