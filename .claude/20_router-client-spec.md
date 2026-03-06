# Router Client Spec

**Status:** Draft
**Scope:** A companion package (`@agentcash/router-client` or similar) that consumes an `@agentcash/router`-powered API in a Zod-forward, runtime-typesafe way.

---

## Problem

Consumers of router-powered APIs need to:
1. Know what routes exist and what they accept
2. Validate request bodies before sending
3. Validate and type response data after receiving
4. Handle auth (API key, SIWX) and payment (x402, MPP) cleanly

Without a client, all of this is manual and untyped.

---

## Solution

A client that bootstraps from the OpenAPI endpoint, reconstructs Zod schemas via `z.fromJSONSchema()` (Zod v4 built-in), and exposes a typed call API.

**Key insight:** Full static TypeScript types require codegen. This client is runtime-typesafe — Zod schemas validate at the boundary and `z.infer` gives accurate types where the schema is statically known. For dynamic discovery, types are `unknown` until narrowed by the parsed schema.

---

## API Design

### Bootstrap

```ts
import { createClient } from '@agentcash/router-client';

const client = await createClient({
  baseUrl: 'https://api.example.com',
  // Optional: provide auth for protected routes
  apiKey: process.env.API_KEY,
});
```

`createClient` fetches `{baseUrl}/api/openapi.json`, parses all schemas via `z.fromJSONSchema()`, and builds a route map. Throws if the spec is unreachable or unparseable.

---

### Route access

```ts
const route = client.route('domain/register');
```

Returns a `ClientRoute` object. Throws if the route key doesn't exist in the spec.

`ClientRoute` shape:

```ts
interface ClientRoute {
  // Reconstructed Zod schemas — use for pre-call validation or type inference
  body: z.ZodTypeAny | undefined;
  query: z.ZodTypeAny | undefined;
  output: z.ZodTypeAny | undefined;

  // Metadata from the spec
  method: 'GET' | 'POST' | 'DELETE' | 'PUT' | 'PATCH';
  path: string;               // e.g. '/api/domain/register'
  summary: string;
  auth: 'paid' | 'siwx' | 'apiKey' | 'unprotected';
  payment: {
    pricingMode: 'fixed' | 'range' | 'quote';
    price?: string;           // present when pricingMode === 'fixed'
    minPrice?: string;
    maxPrice?: string;
    protocols: string[];      // ['x402', 'mpp']
  } | undefined;

  // Make the call
  call(body?: unknown, options?: CallOptions): Promise<unknown>;
}
```

---

### Calling a route

```ts
const result = await route.call({ domain: 'foo.com' });
```

**Pipeline inside `call()`:**

1. If `route.body` exists, run `route.body.parse(body)` — throws `ZodError` on invalid input before any network round-trip
2. Build the fetch request (method, headers, body)
3. Attach auth header if configured (`X-API-Key` or `Authorization: Bearer`)
4. Send the request
5. On `200`: parse response JSON through `route.output` if present, return result
6. On `402`: throw `PaymentRequiredError` with the full challenge attached (consumer handles payment externally)
7. On `401`: throw `UnauthorizedError`
8. On other errors: throw `ApiError` with status and body

---

### `CallOptions`

```ts
interface CallOptions {
  // Override the API key for this call only
  apiKey?: string;

  // For GET routes — passed as query params
  query?: Record<string, string>;

  // Pass through to underlying fetch
  signal?: AbortSignal;
  headers?: Record<string, string>;
}
```

---

### Static typing with known schemas

When the consumer owns both the server route definition and the client call site, they can share the Zod schemas directly for full static types — no codegen needed:

```ts
// shared/schemas.ts (imported by both server and client)
export const RegisterBody = z.object({ domain: z.string() });
export const RegisterOutput = z.object({ registered: z.boolean(), expiresAt: z.string() });

// client call site
const result = RegisterOutput.parse(await route.call(RegisterBody.parse({ domain: 'foo.com' })));
// result: { registered: boolean, expiresAt: string }
```

For cross-service consumers that don't own the schema source, use the reconstructed schemas for runtime safety and treat the output type as `unknown` until narrowed.

---

### Listing all routes

```ts
client.routes()
// Returns: Map<string, ClientRoute>
// Keys are operationId-style: 'domain_register', 'search_query', etc.
// Or use the slash-separated route key: 'domain/register'
```

The spec should support both formats — `client.route('domain/register')` and `client.route('domain_register')` resolve to the same route.

---

## Error Types

```ts
class PaymentRequiredError extends Error {
  status: 402;
  challenge: unknown;       // Raw 402 body — pass to x402/mpp client to pay
  protocols: string[];      // Detected from response headers
}

class UnauthorizedError extends Error {
  status: 401;
}

class ApiError extends Error {
  status: number;
  body: unknown;
}

class RouteNotFoundError extends Error {
  key: string;
}

class SchemaValidationError extends Error {
  // Wraps ZodError — thrown when input fails route.body.parse()
  // or when response fails route.output.parse()
  zodError: ZodError;
  phase: 'input' | 'output';
}
```

---

## Schema reconstruction

Uses `z.fromJSONSchema()` (Zod v4 built-in). Called once at bootstrap per schema, results cached on the `ClientRoute`.

```ts
// Internal bootstrap pseudocode
for (const [apiPath, methods] of Object.entries(spec.paths)) {
  for (const [method, operation] of Object.entries(methods)) {
    const bodyJsonSchema = operation.requestBody?.content?.['application/json']?.schema;
    const queryJsonSchema = operation.requestParams?.query;
    const outputJsonSchema = operation.responses?.['200']?.content?.['application/json']?.schema;

    routes.set(routeKeyFromOperationId(operation.operationId), {
      body:   bodyJsonSchema   ? z.fromJSONSchema(bodyJsonSchema)   : undefined,
      query:  queryJsonSchema  ? z.fromJSONSchema(queryJsonSchema)  : undefined,
      output: outputJsonSchema ? z.fromJSONSchema(outputJsonSchema) : undefined,
      // ...
    });
  }
}
```

Note: `requestParams.query` is a `zod-openapi` extension (not standard OpenAPI). The client must handle it the same as `requestBody` — it's a raw JSON Schema object on the operation.

---

## Out of scope (v1)

- **Payment execution** — `PaymentRequiredError` exposes the challenge; the consumer wires up their x402/MPP wallet client. A future `@agentcash/router-client-x402` wrapper can handle this end-to-end.
- **SIWX auth** — same pattern: throw `UnauthorizedError` with the SIWX challenge; consumer handles signing.
- **Request caching / stale-while-revalidate** on the OpenAPI spec
- **Streaming responses**
- **Multipart / form-data bodies**

---

## Dependencies

- `zod` ^4.0.0 (peer dep — consumer already has it)
- No other runtime dependencies
