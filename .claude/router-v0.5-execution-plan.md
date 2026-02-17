# Router v0.5: DevX Execution Plan

**Date:** 2026-02-16
**Status:** Implemented
**Target:** `@agentcash/router@0.5.0`

## Background

StableStudio is the first codebase to integrate `@agentcash/router` with both **dynamic pricing** (23 job types with per-body cost calculation) and **SIWX identity auth** (job list, job status, upload confirm). It's also the first to adopt MPP dual-protocol alongside x402.

This migration surfaced devX gaps that will affect every future consumer. The server-side builder API (`.paid()`, `.siwx()`, `.body()`, `.handler()`) is excellent — route definitions are 3-6 lines, pricing is declarative, auth is a single method call. These gaps are about the missing pieces *around* that core.

## Execution Summary

| Phase | Item | Priority | Complexity |
|-------|------|----------|------------|
| 1 | Wallet address normalization | Medium | Low |
| 2 | SIWX error codes | Medium | Low |
| 3 | Challenge expiry constant | Low | Trivial |
| 4 | Redis nonce store | High | Medium |
| 5 | SIWX client export | High | Medium |
| 6 | `onAuthVerified` plugin hook | Low | Low |
| 7 | `.paid().siwx()` guard | Low | Trivial |

Phases 1-3 are quick wins (< 1 hour each). Phase 4-5 are the meaty work. Phase 6-7 are polish.

---

## Phase 1: Wallet Address Normalization

**Files:** `src/orchestrate.ts`, `src/protocols/x402.ts`
**Breaking:** No (behavior change, but safer)

### Decision

`ctx.wallet` always returns **lowercase**. Checksumming is a display concern, not a storage concern.

This eliminates an entire class of bugs where consumers forget `.toLowerCase()` before database operations and silently create duplicate user records.

### Implementation

1. In `orchestrate.ts`, normalize wallet after SIWX verification:
   ```typescript
   pluginCtx.setVerifiedWallet(siwx.wallet.toLowerCase());
   ```

2. In `orchestrate.ts`, normalize wallet after x402 verification:
   ```typescript
   pluginCtx.setVerifiedWallet(verify.payer.toLowerCase());
   ```

3. In `orchestrate.ts`, normalize wallet after MPP verification:
   ```typescript
   pluginCtx.setVerifiedWallet(wallet.toLowerCase());
   ```

4. Document in README: "`ctx.wallet` is always lowercase. Use `getAddress()` from viem if you need checksummed for display."

### StableStudio Impact

Remove `.toLowerCase()` from 5 handlers.

---

## Phase 2: SIWX Error Codes

**Files:** `src/auth/siwx.ts`, `src/orchestrate.ts`
**Breaking:** No (adds structure, message unchanged)

### Decision

Return structured error codes so clients can auto-retry transient failures.

### Implementation

1. Change `verifySIWX` return type:
   ```typescript
   type SiwxResult =
     | { valid: true; wallet: string }
     | { valid: false; wallet: null; code: SiwxErrorCode };

   type SiwxErrorCode =
     | 'siwx_missing_header'
     | 'siwx_malformed'
     | 'siwx_expired'
     | 'siwx_nonce_used'
     | 'siwx_invalid_signature';
   ```

2. Update `verifySIWX` to return specific codes. The `@x402/extensions` `validateSIWxMessage` returns `{ valid: false, error: string }` with parseable error strings:
   ```typescript
   function categorizeValidationError(error: string | undefined): SiwxErrorCode {
     if (!error) return 'siwx_malformed';
     const err = error.toLowerCase();

     if (err.includes('expired') || err.includes('message too old')) {
       return 'siwx_expired';
     }
     if (err.includes('nonce validation failed')) {
       return 'siwx_nonce_used';
     }
     return 'siwx_malformed';
   }
   ```

   Flow:
   - No header → `siwx_missing_header`
   - Parse failure → `siwx_malformed`
   - `validation.valid === false` → `categorizeValidationError(validation.error)`
   - Signature mismatch → `siwx_invalid_signature`

   **Note:** String parsing is fragile. File upstream issue with `@x402/extensions` for structured error codes.

3. In `orchestrate.ts`, return JSON error with code:
   ```typescript
   return NextResponse.json(
     { error: siwx.code, message: SIWX_ERROR_MESSAGES[siwx.code] },
     { status: 402 }
   );
   ```

4. Export `SiwxErrorCode` type for client use.

### StableStudio Impact

`fetchWithSiwx` can auto-retry on `siwx_expired` by re-fetching challenge.

---

## Phase 3: Challenge Expiry Constant

**Files:** `src/auth/nonce.ts`, `src/orchestrate.ts`
**Breaking:** No

### Decision

Extract hardcoded 5-minute values to a named constant. Document as a current limitation.

### Implementation

1. Add constant in `src/auth/nonce.ts`:
   ```typescript
   /**
    * SIWX challenge expiry in milliseconds.
    * Currently not configurable — see devX roadmap for future config options.
    */
   export const SIWX_CHALLENGE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
   ```

2. Use in `nonce.ts`:
   ```typescript
   this.seen.set(nonce, Date.now() + SIWX_CHALLENGE_EXPIRY_MS);
   ```

3. Use in `orchestrate.ts`:
   ```typescript
   expirationTime: new Date(Date.now() + SIWX_CHALLENGE_EXPIRY_MS).toISOString(),
   ```

4. Export from `index.ts` for documentation purposes.

---

## Phase 4: Redis Nonce Store

**Files:** `src/auth/nonce.ts` (or new `src/auth/nonce-redis.ts`)
**Breaking:** No (additive)

### Decision

Ship one `createRedisNonceStore(client)` that auto-detects client type (Upstash vs ioredis) and throws a clear error if unrecognized. Primary target is Upstash (StableStudio on Vercel).

Keep `MemoryNonceStore` for testing/development.

### Interface

Current interface is correct and minimal:
```typescript
export interface NonceStore {
  check(nonce: string): Promise<boolean>;
}
```

### Implementation

```typescript
export function createRedisNonceStore(
  client: unknown,
  opts?: { prefix?: string; ttlMs?: number }
): NonceStore {
  const prefix = opts?.prefix ?? 'siwx:nonce:';
  const ttlSeconds = Math.ceil((opts?.ttlMs ?? SIWX_CHALLENGE_EXPIRY_MS) / 1000);

  // Auto-detect client type
  const clientType = detectRedisClientType(client);

  return {
    async check(nonce: string): Promise<boolean> {
      const key = `${prefix}${nonce}`;

      if (clientType === 'upstash') {
        // Upstash: set(key, value, { ex, nx }) returns value if set, null if exists
        const redis = client as { set: (k: string, v: string, opts: { ex: number; nx: boolean }) => Promise<string | null> };
        const result = await redis.set(key, '1', { ex: ttlSeconds, nx: true });
        return result !== null;
      }

      if (clientType === 'ioredis') {
        // ioredis: set(key, value, 'EX', sec, 'NX') returns 'OK' if set, null if exists
        const redis = client as { set: (k: string, v: string, ex: 'EX', sec: number, nx: 'NX') => Promise<'OK' | null> };
        const result = await redis.set(key, '1', 'EX', ttlSeconds, 'NX');
        return result === 'OK';
      }

      // Unreachable if detectRedisClientType throws
      throw new Error('Unknown Redis client type');
    },
  };
}

function detectRedisClientType(client: unknown): 'upstash' | 'ioredis' {
  if (!client || typeof client !== 'object') {
    throw new Error(
      'createRedisNonceStore requires a Redis client. ' +
      'Supported: @upstash/redis, ioredis. ' +
      'Pass your Redis client instance as the first argument.'
    );
  }

  // Upstash Redis has a distinctive constructor name or specific methods
  const constructor = (client as object).constructor?.name;
  if (constructor === 'Redis' && 'url' in client) {
    // Upstash Redis client has a 'url' property
    return 'upstash';
  }

  // ioredis has 'options' and 'status' properties
  if ('options' in client && 'status' in client) {
    return 'ioredis';
  }

  // Fallback: check if set() signature matches Upstash (object options)
  // This is a runtime heuristic — we try Upstash style first since it's primary target
  if (typeof (client as any).set === 'function') {
    // Assume Upstash-compatible if we can't determine otherwise
    // Will fail at runtime with clear error if wrong
    return 'upstash';
  }

  throw new Error(
    'Unrecognized Redis client. ' +
    'Supported: @upstash/redis, ioredis. ' +
    'If using a different client, implement NonceStore interface directly.'
  );
}
```

Key points:
- Single function, auto-detects client type
- Primary target: Upstash (Vercel deployments)
- Falls back to ioredis detection
- Clear error messages guide users to supported clients or DIY
- Uses atomic `SET ... NX EX` pattern (both clients support this semantically)

### Package Dependencies

Add both as **optional peer dependencies**:
```json
{
  "peerDependencies": {
    "@upstash/redis": "^1.0.0",
    "ioredis": "^5.0.0"
  },
  "peerDependenciesMeta": {
    "@upstash/redis": { "optional": true },
    "ioredis": { "optional": true }
  }
}
```

### StableStudio Impact

Replace `new MemoryNonceStore()` with `createRedisNonceStore(redis)`. SIWX replay protection now works across Vercel instances.

---

## Phase 5: SIWX Client Export

**Files:** New `src/client/index.ts`, `src/client/siwx.ts`
**Breaking:** No (additive)

### Decision

Export from `@agentcash/router/client` subpath. Re-export `@x402/extensions` types directly — they own the signer interface, we pass through. If we need our own abstraction later, we can add an adapter layer without breaking the API.

Requires tsup multi-entry and package.json exports update.

### API Design

```typescript
// @agentcash/router/client

// Re-export @x402/extensions types for signer compatibility
export type { EVMSigner } from '@x402/extensions/sign-in-with-x';

// Re-export error codes from server (Phase 2)
export type { SiwxErrorCode } from '@agentcash/router';

// Challenge type from 402 response
export interface SiwxChallenge {
  domain: string;
  uri: string;
  version: string;
  chainId: string;
  type: 'eip191' | 'ed25519';
  nonce: string;
  issuedAt: string;
  expirationTime?: string;
}

export function fetchWithSiwx(
  url: string,
  options: RequestInit & { signer: EVMSigner },
): Promise<Response>;
```

### Implementation

**`fetchWithSiwx`:**
```typescript
import {
  createSIWxPayload,
  encodeSIWxHeader,
  type EVMSigner,
} from '@x402/extensions/sign-in-with-x';

export async function fetchWithSiwx(
  url: string,
  options: RequestInit & { signer: EVMSigner },
): Promise<Response> {
  const { signer, ...init } = options;

  // First request — expect 402 with challenge
  const challengeRes = await fetch(url, init);

  if (challengeRes.status !== 402) {
    return challengeRes; // Not protected, return as-is
  }

  // Parse challenge from response
  const body = await challengeRes.json();
  const challenge = body.extensions?.['sign-in-with-x'];
  if (!challenge) {
    throw new Error('Expected SIWX challenge in 402 response');
  }

  // Pick first supported chain (EVM)
  const chainInfo = challenge.supportedChains?.find(
    (c: { type: string }) => c.type === 'eip191'
  ) ?? { chainId: 'eip155:8453', type: 'eip191' };

  const completeInfo = {
    ...challenge.info,
    chainId: chainInfo.chainId,
    type: chainInfo.type,
  };

  // Create signed payload using @x402/extensions helper
  const payload = await createSIWxPayload(completeInfo, signer);
  const header = encodeSIWxHeader(payload);

  // Retry with auth header
  return fetch(url, {
    ...init,
    headers: {
      ...init.headers,
      'SIGN-IN-WITH-X': header,
    },
  });
}

// Re-export for convenience
export { type EVMSigner } from '@x402/extensions/sign-in-with-x';
```

### Signer Compatibility

`@x402/extensions` defines `EVMSigner` as:
```typescript
interface EVMSigner {
  signMessage: (args: { message: string; account?: unknown }) => Promise<string>;
  account?: { address: string };
  address?: string;
}
```

This is compatible with:
- `viem.WalletClient` (browser wallet via wagmi/Privy)
- `viem.PrivateKeyAccount` (server-side)
- Any object implementing the interface

### Package Setup

1. Add entry to tsup config:
   ```typescript
   entry: ['src/index.ts', 'src/client/index.ts'],
   ```

2. Add subpath export to package.json:
   ```json
   "exports": {
     ".": { "import": "./dist/index.js", "require": "./dist/index.cjs" },
     "./client": { "import": "./dist/client.js", "require": "./dist/client.cjs" }
   }
   ```

3. Ensure `@x402/extensions` is in `dependencies` (already is for server SIWX).

### StableStudio Impact

Delete `src/lib/x402-client/siwe.ts` (~60 lines). Replace all `fetchWithSiwe()` calls with `fetchWithSiwx()` from `@agentcash/router/client`.

---

## Phase 6: `onAuthVerified` Plugin Hook

**Files:** `src/plugin.ts`, `src/orchestrate.ts`
**Breaking:** No (additive)

### Decision

Add `onAuthVerified` hook that fires after SIWX or API key verification, before handler.

### Implementation

1. Add to `RouterPlugin` interface:
   ```typescript
   onAuthVerified?(ctx: PluginContext, event: AuthEvent): void;
   ```

2. Add `AuthEvent` type:
   ```typescript
   export interface AuthEvent {
     authMode: 'siwx' | 'apiKey';
     wallet: string;
     route: string;
   }
   ```

3. Fire in `orchestrate.ts` after successful SIWX verification:
   ```typescript
   firePluginHook(plugin, 'onAuthVerified', pluginCtx, {
     authMode: 'siwx',
     wallet: siwx.wallet,
     route: entry.key,
   });
   ```

4. Fire after successful API key verification (similar location).

### StableStudio Impact

`@agentcash/telemetry` can log auth events to ClickHouse with zero handler changes.

---

## Phase 7: `.paid().siwx()` Guard

**Files:** `src/builder.ts`
**Breaking:** No (compile-time only, clearer error)

### Decision

The type system already prevents `.paid().siwx()` at compile time. Add a runtime guard with a clear error message for JavaScript users or type-escape scenarios.

### Implementation

In `RouteBuilder.siwx()`:
```typescript
siwx(opts?: SiwxOptions): RouteBuilder<...> {
  if (this.entry.authMode === 'paid') {
    throw new Error(
      'Cannot combine .paid() and .siwx() on the same route. ' +
      'Paid routes get wallet identity from the payment proof. ' +
      'Use separate routes if you need both payment and SIWX auth.'
    );
  }
  // ... rest of implementation
}
```

Similarly in `.paid()` if already `.siwx()`.

---

## Migration Checklist

- [x] Phase 1: Wallet normalization
- [x] Phase 2: SIWX error codes
- [x] Phase 3: Expiry constant
- [x] Phase 4: Redis nonce store
- [x] Phase 5: SIWX client export
- [x] Phase 6: `onAuthVerified` hook
- [x] Phase 7: `.paid().siwx()` guard
- [x] Bump to v0.5.0
- [ ] Update StableStudio to use new APIs
- [ ] Delete StableStudio `src/lib/x402-client/siwe.ts`
