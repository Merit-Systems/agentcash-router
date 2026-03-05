---
"@agentcash/router": major
---

# Unified discovery config

Discovery is now configured once in `createRouter({ discovery })` instead of split across `openapi()` and `wellKnown()` call sites. A new `llmsTxt()` handler serves agent guidance as plain text.

## Migration

**Before:**
```typescript
export const GET = router.openapi({
  title: 'My API',
  version: '1.0.0',
  llmsTxtUrl: 'https://example.com/llms.txt',
  ownershipProofs: [...],
});

export const GET = router.wellKnown({
  instructions: 'Use /api/search for...',
  ownershipProofs: [...],
});
```

**After:**
```typescript
const router = createRouter({
  baseUrl: '...',
  discovery: {
    title: 'My API',
    version: '1.0.0',
    guidance: 'Use /api/search for...',  // serves as wellknown instructions + /llms.txt
    ownershipProofs: [...],
  },
});

export const GET = router.openapi();
export const GET = router.wellKnown();
export const GET = router.llmsTxt();  // new
```

## Breaking changes

- `router.openapi(options)` and `router.wellKnown(options?)` are now zero-arg — options move to `createRouter({ discovery })`
- `OpenAPIOptions` and `WellKnownOptions` types removed — use `DiscoveryConfig`
- `wellKnown.instructions` renamed to `discovery.guidance`
- `llmsTxtUrl` removed — inline content via `discovery.guidance` (string or async fn)
- `baseUrl` override removed from OpenAPI options — always uses `RouterConfig.baseUrl`
