# MPP: The Internet Payments Protocol

The open protocol for internet payments.

<!--
Sitemap:
- [CLI Playground](/_cli)
- [Page Not Found](/404)
- [Brand](/brand): MPP brand assets and guidelines
- [Frequently asked questions](/faq): Common questions about the Machine Payments Protocol
- [Machine Payments Protocol](/overview): The open protocol for internet-native payments
- [Payment methods](/payment-methods/): Available methods and how to choose one
- [Protocol overview](/protocol/): Standardizing HTTP 402 for machine-to-machine payments
- [Quickstart](/quickstart/): Get started with MPP in minutes
- [SDKs & Tools](/sdk/): Official implementations in multiple languages
- [Building with AI](/guides/building-with-ai): Use llms-full.txt to give your coding agent complete MPP context.
- [Accept one-time payments](/guides/one-time-payments): Charge per request with a payment-gated API
- [Accept pay-as-you-go payments](/guides/pay-as-you-go): Session-based billing with payment channels
- [Accept streamed payments](/guides/streamed-payments): Per-token billing over Server-Sent Events
- [Charge](/intents/charge): Immediate one-time payments
- [Custom](/payment-methods/custom): Build your own payment method
- [Stripe](/payment-methods/stripe/): Cards, wallets, and other Stripe supported payment methods
- [Tempo](/payment-methods/tempo/): Stablecoin payments on the Tempo blockchain
- [Challenges](/protocol/challenges): Server-issued payment requirements
- [Credentials](/protocol/credentials): Client-submitted payment proofs
- [HTTP 402 payment required](/protocol/http-402): The status code that signals payment is required
- [Receipts](/protocol/receipts): Server acknowledgment of successful payment
- [Transports](/protocol/transports/): HTTP and MCP bindings for payment flows
- [Client quickstart](/quickstart/client): Handle payment-gated resources automatically
- [presto](/quickstart/presto): Make paid HTTP requests from the command line
- [Server quickstart](/quickstart/server): Charge for resources and verify payment credentials
- [Python SDK](/sdk/python/): The pympp Python library
- [Rust SDK](/sdk/rust/): The mpp Rust library
- [Getting started](/sdk/typescript/): The mppx TypeScript library
- [presto](/tools/presto): Command-line HTTP client for MPP
- [Stripe charge](/payment-methods/stripe/charge): One-time payments using Stripe Payment Tokens
- [Tempo charge](/payment-methods/tempo/charge): One-time TIP-20 token transfers
- [Session](/payment-methods/tempo/session): Low-cost high-throughput payments
- [HTTP transport](/protocol/transports/http): Payment flows using standard HTTP headers
- [MCP transport](/protocol/transports/mcp): Payment flows for AI tool calls
- [Client](/sdk/python/client): Handle 402 responses automatically
- [Core Types](/sdk/python/core): Challenge, Credential, and Receipt primitives
- [Server](/sdk/python/server): Protect endpoints with payment requirements
- [Client](/sdk/rust/client): Handle 402 responses automatically
- [Server](/sdk/rust/server): Protect endpoints with payment requirements
- [CLI Reference](/sdk/typescript/cli): Built-in command-line tool for paid HTTP requests
- [Method.from](/sdk/typescript/Method.from)
- [presto examples](/tools/presto/examples): Real-world usage patterns
- [tempo](/sdk/typescript/client/Method.tempo): Register all Tempo intents
- [Method.tempo.charge](/sdk/typescript/client/Method.tempo.charge): One-time payments
- [Method.tempo.session](/sdk/typescript/client/Method.tempo.session): Low-cost high-throughput payments
- [Mppx.create](/sdk/typescript/client/Mppx.create)
- [Mppx.restore](/sdk/typescript/client/Mppx.restore)
- [Transport.from](/sdk/typescript/client/Transport.from)
- [Transport.http](/sdk/typescript/client/Transport.http)
- [Transport.mcp](/sdk/typescript/client/Transport.mcp)
- [BodyDigest.compute](/sdk/typescript/core/BodyDigest.compute)
- [BodyDigest.verify](/sdk/typescript/core/BodyDigest.verify)
- [Challenge.deserialize](/sdk/typescript/core/Challenge.deserialize)
- [Challenge.from](/sdk/typescript/core/Challenge.from)
- [Challenge.fromHeaders](/sdk/typescript/core/Challenge.fromHeaders)
- [Challenge.fromMethod](/sdk/typescript/core/Challenge.fromMethod)
- [Challenge.fromResponse](/sdk/typescript/core/Challenge.fromResponse)
- [Challenge.meta](/sdk/typescript/core/Challenge.meta)
- [Challenge.serialize](/sdk/typescript/core/Challenge.serialize)
- [Challenge.verify](/sdk/typescript/core/Challenge.verify)
- [Credential.deserialize](/sdk/typescript/core/Credential.deserialize)
- [Credential.from](/sdk/typescript/core/Credential.from)
- [Credential.fromRequest](/sdk/typescript/core/Credential.fromRequest)
- [Credential.serialize](/sdk/typescript/core/Credential.serialize)
- [Expires](/sdk/typescript/core/Expires)
- [Method.from](/sdk/typescript/core/Method.from)
- [Method.toClient](/sdk/typescript/core/Method.toClient)
- [Method.toServer](/sdk/typescript/core/Method.toServer)
- [PaymentRequest.deserialize](/sdk/typescript/core/PaymentRequest.deserialize)
- [PaymentRequest.from](/sdk/typescript/core/PaymentRequest.from)
- [PaymentRequest.serialize](/sdk/typescript/core/PaymentRequest.serialize)
- [Receipt.deserialize](/sdk/typescript/core/Receipt.deserialize)
- [Receipt.from](/sdk/typescript/core/Receipt.from)
- [Receipt.fromResponse](/sdk/typescript/core/Receipt.fromResponse)
- [Receipt.serialize](/sdk/typescript/core/Receipt.serialize)
- [Elysia](/sdk/typescript/middlewares/elysia): Payment middleware for Elysia
- [Express](/sdk/typescript/middlewares/express): Payment middleware for Express
- [Hono](/sdk/typescript/middlewares/hono): Payment middleware for Hono
- [Next.js](/sdk/typescript/middlewares/nextjs): Payment middleware for Next.js
- [Method.tempo.charge](/sdk/typescript/server/Method.tempo.charge)
- [Method.tempo.session](/sdk/typescript/server/Method.tempo.session): Low-cost high-throughput payments
- [Mppx.create](/sdk/typescript/server/Mppx.create)
- [Mppx.toNodeListener](/sdk/typescript/server/Mppx.toNodeListener)
- [Transport.from](/sdk/typescript/server/Transport.from)
- [Transport.http](/sdk/typescript/server/Transport.http)
- [Transport.mcp](/sdk/typescript/server/Transport.mcp)
- [Transport.mcpSdk](/sdk/typescript/server/Transport.mcpSdk)
-->

# CLI Playground

<CliPlayground />

<NotFoundPage />

# Brand \[MPP brand assets and guidelines]

Download MPP logos and icons for use in your projects, articles, and integrations.

## Logo

The full MPP logo for use in headers, documentation, and marketing materials.

### Light background

<div style={{ padding: '2rem', backgroundColor: '#f5f5f5', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
  <img src="/mpp-logo-light.svg" alt="MPP Logo" style={{ maxWidth: '300px' }} />
</div>

<a href="/mpp-logo-light.svg" download>Download SVG</a>

### Dark background

<div style={{ padding: '2rem', backgroundColor: '#0a0a0a', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
  <img src="/mpp-logo-dark.svg" alt="MPP Logo" style={{ maxWidth: '300px' }} />
</div>

<a href="/mpp-logo-dark.svg" download>Download SVG</a>

## Icon

The square MPP icon for favicons, app icons, and compact spaces.

### Light background

<div style={{ padding: '2rem', backgroundColor: '#f5f5f5', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
  <img src="/mpp-icon-dark.svg" alt="MPP Icon" style={{ width: '120px', height: '120px' }} />
</div>

<a href="/mpp-icon-dark.svg" download>Download SVG</a>

### Dark background

<div style={{ padding: '2rem', backgroundColor: '#0a0a0a', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
  <img src="/mpp-icon.svg" alt="MPP Icon" style={{ width: '120px', height: '120px' }} />
</div>

<a href="/mpp-icon.svg" download>Download SVG</a>

## ASCII art

An animated ASCII version of the logo for terminal interfaces and developer tools.

<div style={{ padding: '2rem', backgroundColor: '#f5f5f5', borderRadius: '8px', overflow: 'auto' }}>
  <AsciiLogo />
</div>

<a href="/mpp-ascii.txt" download>Download TXT</a>

### React component

The animated ASCII logo component is available in the site source code at [`src/components/AsciiLogo.tsx`](https://github.com/tempoxyz/mpp/blob/main/src/components/AsciiLogo.tsx).

## Usage guidelines

* Use the logo on light backgrounds with the dark variant, and on dark backgrounds with the light variant
* Maintain adequate spacing around the logo
* Do not distort, rotate, or alter the logo colors
* Use the square icon for favicons and app icons where the full logo does not fit

# Frequently asked questions \[Common questions about the Machine Payments Protocol]

## What is MPP?

MPP (Machine Payments Protocol) is an internet-native protocol that lets any client— AI agents, software, or humans—pay for services inline over HTTP. The protocol is payment-method agnostic, open by design, and engineered for extensibility, performance, and security.

## Is MPP only for stablecoins?

No. MPP is payment-method agnostic—the protocol works with any payment rail.

Today, [Tempo](/payment-methods/tempo) stablecoin payments and [Stripe](/payment-methods/stripe) (credit cards, wallets, and other payment methods) are in production. Anyone can build a [custom payment method](/payment-methods/custom) by implementing the core control flow for their payment rail.

## Do I need a stablecoin wallet?

No. With Stripe, you can use traditional cards and wallets without stablecoins.

For Tempo payments, you need a stablecoin wallet to sign transactions. The SDK and `presto` CLI handle key management for you.

## How is MPP different from x402?

Both MPP and x402 use HTTP `402` to signal that a request requires payment. The key differences:

* **Payment-method agnostic.** MPP supports stablecoins, cards, wallets, and custom rails through extensible payment method specifications. x402 only supports blockchains.
* **Designed for production.** MPP supports idempotency, expiration, and request-tampering mitigations as first-class primitives.
* **Performant payments.** MPP's session intent enables pay-as-you-go metering for payments as small as 0.0001 USD. MPP sessions can achieve sub-100ms latency and near-zero per-request fees, enabling high-throughput, low-value payments for applications like token streaming or high throughput content aggregation.
* **Permissionless extensibility.** Anyone can author and publish a new payment method or intent specification without approval from a foundation or intermediary. Payment methods compete on adoption and are independently maintained without the explicit permission of a central authority.

## Is MPP compatible with x402?

Yes. The core x402 "exact" flows map directly onto MPP's charge intent. MPP clients can consume existing x402 services, and MPP extends beyond what x402 supports with sessions, idempotency, and multi-rail payment methods.

## Why build MPP on Tempo?

High-throughput, low-value transactions require specific properties from the settlement layer:

* **Fast, deterministic finality**—Tempo consensus provides certainty that a payment has settled, not probabilistic confirmation.
* **Low, predictable cost**—Transaction fees stay stable regardless of global network congestion.
* **Payment lanes**—Dedicated transaction routing for payment traffic, ensuring reliability even under heavy load.
* **Stablecoin-native**—TIP-20 stablecoins (USDC, USDT) are first-class citizens, so payments are denominated in familiar currency.

These properties make Tempo well-suited as a settlement layer for machine payments where speed, cost, and reliability matter.

## What are sessions?

Sessions are a Tempo-specific payment intent that enables streaming, pay-as-you-go payments. Instead of paying per request, a client opens a session (depositing funds into an escrow contract), then makes many requests by issuing signed vouchers off-chain. The server periodically settles the accumulated vouchers on-chain. See the [session documentation](/payment-methods/tempo/session) for details.

Because sessions bypass consensus for individual interactions, they achieve client-to-server latency (low double-digit milliseconds), near-zero per-request fees, and horizontally scalable throughput. The bottleneck is CPU, not blockchain TPS.

## How much does it cost?

Pricing is set per service. For individual charge payments, typical prices range from $0.01 to $0.10 per request. For session-based payments, the per-request cost can go much lower because each interaction is a signed voucher rather than an on-chain transaction—only net settlement hits the chain.

The protocol itself is free and open. There are no licensing fees for implementing MPP.

## Is it safe?

MPP requires TLS 1.2+ for all connections. Challenge IDs are cryptographically bound to prevent replay attacks. The protocol never performs side effects on unpaid requests—your client only pays after verifying what it is paying for.

Payments use the same security model as the underlying payment method. For Tempo, that means cryptographic signatures over every transaction. For Stripe, it means Stripe's existing fraud and dispute infrastructure.

## Can any AI agent use MPP?

Yes. Any agent that can run shell commands can use MPP—point it at `presto` and a paid service endpoint. The [`presto` quickstart](/quickstart/presto) has copy-paste instructions for Claude, Codex, and Amp.

For programmatic integration, the [TypeScript](/sdk/typescript), [Python](/sdk/python), and [Rust](/sdk/rust) SDKs provide native support.

## What happens if a payment fails?

The service returns an error with details following [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457) (Problem Details for HTTP APIs). Your client can retry with a different payment method or surface the error. No money is deducted for failed requests.

## Can I accept MPP payments for my own service?

Yes. See the [server quickstart](/quickstart/server) to start accepting payments in a few lines of code. The TypeScript SDK includes middleware for popular frameworks including Hono, Express, Next.js, and Elysia.

## Is MPP an IETF standard?

The core [Payment HTTP Authentication Scheme](https://datatracker.ietf.org/doc/draft-ryan-httpauth-payment/) is on the IETF standards track. Payment method and intent IETF Specs (charge, session, authorize) are separate documents that anyone can author and publish independently—they do not require IETF approval. This mirrors how the web works: HTTP is standardized, but content types and authentication schemes evolve independently.

## Can I use MPP outside of HTTP?

Yes. MPP includes an [MCP transport binding](/protocol/transports/mcp) that maps the Challenge-Credential-Receipt flow onto the Model Context Protocol. This means MCP servers can monetize tool calls directly, and agents pay autonomously without OAuth or account setup.

## Who is building MPP?

MPP is co-authored by Tempo and Stripe. The core specification is developed in the open and designed to be extended by any payment network or provider. The [Payment HTTP Authentication Scheme](https://datatracker.ietf.org/doc/draft-ryan-httpauth-payment/) is submitted to the IETF.

# Machine Payments Protocol \[The open protocol for internet-native payments]

The Machine Payments Protocol (MPP) lets you accept payments from any client— agents, apps, or humans—using standard HTTP control flows. Clients pay inline with their request, and you receive payment confirmation before delivering the response.

MPP is built around a simple extensible core and is designed to be neutral to the implementation of underlying payment flows and methods.

* **Open standard built for the internet**—Built on an [open specification proposed to the IETF](https://tempoxyz.github.io/mpp-specs/), not a proprietary API
* **Designed for payments**—Idempotency, security, and receipts are first-class primitives
* **Multi rail**—Stablecoins, cards, bank transfers, and digital wallets. All payment methods can be supported through one protocol and flexible control flow
* **Multi currency**—The protocol is currency agnostic, allowing for transactions in USD, EUR, BRL, USDC, BTC, or any other asset
* **Composable and designed for extension**—A flexible core allows advanced flows like disputes or additional primitives like identity to be gradually introduced

## The problem with payments on the internet

There is no shortage of ways to pay for things on the internet. Hundreds of payment methods give users ample space for personal preference, and optimized payment forms with one-click checkout ensure that the act of paying is low-friction and highly secure.

However, the very things that make these payment flows familiar and fast for human purchasers are structural headwinds for programmatic consumption. Many have tried, but it is a consistent uphill battle to fight browser automation pipelines, visual captchas, and ever changing payment forms—all of which reduce reliability, increase latency, and bear high costs.

This is not the fault of any individual payment method or credential. This is a global problem which exists at the *interface* level: how buyer and seller negotiate cost, supported payment methods, and ultimately transact.

The Machine Payments Protocol addresses this gap by providing an internet-native payment interface that strips away the complexity of rich checkout flows, while still providing robust security and reliability. By using MPP, you can accept payments from any client — agents, apps, or humans — and across any payment method, without the need for a complex checkout flows and integrations.

## Try it out

This documentation site is itself an MPP server. Create an account, fund it with testnet tokens, and make a paid request to see the full flow in action.

<Cli.Demo title="Make a request with payment" token={pathUsd} restartStep={1}>
  <Cli.Startup />

  <Cli.ConnectWallet />

  <Cli.Faucet />

  <Cli.Ping />
</Cli.Demo>

## Use cases

* **Paid APIs**—Accept payments inline without requiring API keys, billing accounts, or manual signup. Clients pay per request.
* **MCP servers**—Monetize tool calls served through the Model Context Protocol (MCP). Clients pay autonomously without complicated OAuth or account setup.
* **Digital content**—Monetize articles, data, or media without subscription paywalls. Charge per access or per query.

## Payment flow

When a client requests a paid resource, the server returns a `402` response with the payment options they support. The client chooses a payment method, fulfills the request and retries with a payment `Credential` which contains proof of payment. The server verifies the payment and returns the resource with a `Receipt` which contains proof of delivery.

<PaymentFlowDiagram />

## Official SDKs

MPP comes with a suite of official SDKs maintained by [Tempo Labs](https://tempo.xyz) and [Wevm](https://wevm.dev). The SDKs offer high-level abstractions and low-level primitives to implement and extend the Machine Payments Protocol.

<Cards>
  <TypeScriptSdkCard />

  <PythonSdkCard />

  <RustSdkCard />
</Cards>

## Next steps

<Cards>
  <QuickstartCard />

  <ProtocolConceptsCard />

  <SpecCard to="https://tempoxyz.github.io/mpp-specs/" />
</Cards>

# Payment methods \[Available methods and how to choose one]

Payment methods define how clients pay for resources protected by the Machine Payments Protocol. Each method specifies its payment rails, credential format, and verification logic.

## Overview

When a server responds with `402` Payment Required, the `WWW-Authenticate` header includes a `method` parameter indicating which payment method to use. If supported, the client can then use the corresponding payment method to generate a Credential and retry the request.

<Tabs>
  <Tab title="Tempo">
    ```http
    HTTP/1.1 402 Payment Required
    WWW-Authenticate: Payment method="tempo" intent="charge", ...
    ```
  </Tab>

  <Tab title="Stripe">
    ```http
    HTTP/1.1 402 Payment Required
    WWW-Authenticate: Payment method="stripe", intent="charge", ...
    ```
  </Tab>
</Tabs>

## Available methods

<Cards>
  <TempoMethodCard />

  <StripeMethodCard />

  <CustomMethodCard />
</Cards>

# Protocol overview \[Standardizing HTTP 402 for machine-to-machine payments]

The Machine Payments Protocol (MPP) is an internet-native protocol for machine-to-machine payments. It standardizes HTTP `402` "Payment Required" with an extensible framework that works with any payment network.

These docs provide a developer-friendly overview. For the full specification, see the full [IETF Specs](https://tempoxyz.github.io/mpp-specs/).

## Flow

<PaymentFlowDiagram />

## Core concepts

<Cards>
  <Http402Card />

  <ChallengesCard />

  <CredentialsCard />

  <ReceiptsCard />

  <TransportsCard />
</Cards>

## Status codes

MPP uses HTTP status codes consistently to signal payment-related conditions:

:::info\[Consistent 402 usage]
MPP uses `402` for all payment-related challenges, including failed credential validation. This differs from other HTTP authentication schemes that use `401` for failed credentials. The distinction:

* **`402`** = Payment barrier (initial challenge or retry needed)
* **`401`** = Authentication failure unrelated to payment
* **`403`** = Payment succeeded but access denied by policy
  :::

| Condition | Status | Response |
|-----------|--------|----------|
| Resource requires payment, no credential provided | <Badge variant="danger">402</Badge> | Fresh challenge in `WWW-Authenticate` |
| Malformed credential (invalid base64url, bad JSON) | <Badge variant="danger">402</Badge> | Fresh challenge + `malformed-credential` problem |
| Unknown, expired, or already-used challenge id | <Badge variant="danger">402</Badge> | Fresh challenge + `invalid-challenge` problem |
| Payment proof invalid or verification failed | <Badge variant="danger">402</Badge> | Fresh challenge + `verification-failed` problem |
| Payment verified, access granted | <Badge variant="success">200</Badge> | Resource + optional `Payment-Receipt` |
| Payment verified, but policy denies access | <Badge variant="warning">403</Badge> | No challenge (payment was valid) |

See [HTTP 402](/protocol/http-402) for details on when to return each status code.

## Payment method agnostic

MPP works with any payment network or currency. The core protocol defines the framework, while **payment methods** define how specific networks integrate:

:::info\[Extensible by design]
Anyone can define new payment methods. The protocol requires that methods define their `request` schema (what the server asks for) and `payload` schema (what the client provides as proof).
:::

| Method | Description | Status |
|--------|-------------|--------|
| [Tempo](/payment-methods/tempo) | Native stablecoin payments on Tempo Network | <Badge variant="success">Production</Badge> |
| [Stripe](/payment-methods/stripe) | Traditional card payment methods through Stripe | <Badge variant="success">Production</Badge> |

Each payment method specifies its own `request` and `payload` schemas while sharing the common challenge/credential flow.

### Payment method requirements

Payment method specifications must define:

1. **Method identifier**—Unique lowercase ASCII string (for example, `tempo` or `stripe`)
2. **Request schema**—JSON structure for the `request` parameter in challenges
3. **Payload schema**—JSON structure for credential `payload` fields
4. **Verification procedure**—How servers validate payment proofs
5. **Settlement procedure**—How payment is finalized

## Payment intents

Payment intents describe the type of payment being requested. Common intents include:

* **`charge`**—One-time payment that settles immediately
* **`authorize`**—Authorization that can be captured later
* **`subscription`**—Recurring payment authorization

Intent IETF Specs define:

* Required and optional `request` fields
* `payload` requirements
* Verification and settlement semantics

Servers can offer multiple intents in separate challenges, allowing clients to choose:

```http
WWW-Authenticate: Payment id="abc", method="tempo", intent="charge", ...
WWW-Authenticate: Payment id="def", method="tempo", intent="authorize", ...
```

## Request body binding

For requests with bodies (`POST`, `PUT`, `PATCH`), servers can bind the challenge to the request body using a `digest` parameter:

```http
WWW-Authenticate: Payment id="...",
    method="tempo",
    intent="charge",
    digest="sha-256=:X48E9qOokqqrvdts8nOJRJN3OWDUoyWxBf7kbu9DBPE=:",
    request="..."
```

When a `digest` is present, clients must submit the credential with a request body whose digest matches. This prevents clients from modifying the request body after receiving the challenge.

The digest is computed per [RFC 9530](https://www.rfc-editor.org/rfc/rfc9530) Content-Digest header format.

## Error handling

Failed payment attempts return `402` with a fresh challenge and a Problem Details [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457) body:

```json
{
  "type": "https://paymentauth.org/problems/verification-failed",
  "title": "Payment Verification Failed",
  "status": 402,
  "detail": "Invalid payment proof."
}
```

Common error codes (full type URI: `https://paymentauth.org/problems/{code}`):

| Code | Description |
|------|-------------|
| `payment-required` | Resource requires payment |
| `payment-insufficient` | Amount too low |
| `payment-expired` | Challenge or authorization expired |
| `verification-failed` | Proof invalid |
| `method-unsupported` | Method not accepted |
| `malformed-credential` | Invalid credential format |
| `invalid-challenge` | Challenge ID unknown, expired, or already used |

Use the `Retry-After` header to indicate when clients can retry failed payments.

## Security considerations

### Transport security

**TLS 1.2 or later is REQUIRED** for all Payment authentication flows. TLS 1.3 is recommended. Payment credentials contain sensitive authorization data that could result in financial loss if intercepted.

### Replay protection

Payment methods must provide single-use proof semantics. A payment proof can be used exactly once; subsequent attempts to use the same proof must be rejected.

### Idempotency

Servers must not perform side effects (database writes, external API calls) for requests that have not been paid. The unpaid request that triggers a `402` challenge must not modify server state beyond recording the challenge itself.

For non-idempotent methods (`POST`, `PUT`, `DELETE`), accept an `Idempotency-Key` header to enable safe client retries.

### Amount verification

Clients must verify before authorizing payment:

1. Requested amount is reasonable for the resource
2. Recipient/address is expected
3. Currency/asset is as expected
4. Validity window is appropriate

:::warning\[Don't trust descriptions]
Clients must not rely on the `description` parameter for payment verification. Malicious servers could provide a misleading description while the actual `request` payload requests a different amount.
:::

### Credential handling

Payment credentials are bearer tokens that authorize financial transactions. Servers and intermediaries must not log Payment credentials or include them in error messages, debugging output, or analytics.

### Caching

Payment challenges contain unique identifiers and time-sensitive payment data that must not be cached. Servers must send `Cache-Control: no-store` with `402` responses. Responses containing `Payment-Receipt` headers must include `Cache-Control: private`.

## Extensibility

The protocol is designed for extensibility, with simple constraints where required for security or a consistent developer experience:

### Custom parameters

Implementations may define additional parameters in challenges:

* Parameters must use lowercase names
* Unknown parameters must be ignored by clients
* This allows payment methods to add method-specific fields

### Size considerations

* Keep challenges under 8 KB
* Clients must handle challenges of at least 4 KB
* Servers must handle credentials of at least 4 KB

### Internationalization

* All string values use UTF-8 encoding
* Payment method identifiers are restricted to ASCII lowercase
* Use ASCII-only values for the `realm` parameter
* The `description` parameter can contain localized text; use `Accept-Language` to determine appropriate language

## Full specification

These docs provide a practical overview. For the full IETF Specs:

:::note\[Read the full IETF Specs]

* <a href="https://tempoxyz.github.io/mpp-specs/draft-httpauth-payment-00" data-v="true">Payment HTTP Authentication Scheme</a>—Core protocol spec (draft-httpauth-payment-00)
* [Payment Methods](https://tempoxyz.github.io/mpp-specs/)—Payment method definitions
* [Payment Intents](https://tempoxyz.github.io/mpp-specs/)—Intent types (charge, authorize, subscription)
* <a href="https://tempoxyz.github.io/mpp-specs/draft-payment-transport-mcp-00" data-v="true">MCP Transport</a>—Model Context Protocol binding
* [HTTP Transport](https://tempoxyz.github.io/mpp-specs/)—HTTP binding details
  :::

The full specification includes detailed ABNF grammar, security analysis, IANA considerations, and complete examples for various payment scenarios.

# Quickstart \[Get started with MPP in minutes]

MPP lets APIs charge for access. Servers request payment when you hit a paid endpoint; clients pay; servers verify and return the resource. [Learn more](/protocol).

## Start prompting

Paste one of these into your AI coding agent to build your first MPP app or service:

<QuickstartPrompts />

## Start building

Pick a starting point based on your role:

<Cards>
  <ClientQuickstartCard />

  <ServerQuickstartCard />

  <PrestoCliCard />
</Cards>

# SDKs & Tools \[Official implementations in multiple languages]

<Cards>
  <TypeScriptSdkCard />

  <PythonSdkCard />

  <RustSdkCard />

  <PrestoCliCard />
</Cards>

# Building with AI \[Give your agent MPP context]

Point your coding agent at <a href="/llms-full.txt" target="_self">`llms-full.txt`</a>, a single file containing the complete documentation.

## Get started

Copy this URL and paste it into your agent (Claude Code, Codex, Amp, or similar):

```
https://mpp.tempo.xyz/llms-full.txt
```

Then ask your agent something like:

```
Use https://mpp.tempo.xyz/llms-full.txt as reference.
Add mppx to my Next.js app with a /api/checkout route.
```

Your agent now has full context on MPP's client and server APIs, payment methods, and integration patterns.

## Advanced options

These alternatives provide different ways to consume the docs depending on your workflow.

### Agent skills

Install skills for your coding agent using the [`skills` CLI](https://github.com/vercel-labs/skills):

```bash
npx skills install wevm/mppx -g
```

After installing, your agent knows how to integrate `mppx` with your chosen framework.

### llms.txt

Each page has a [`llms.txt`](https://llmstxt.org) file for LLM consumption:

* <a href="/llms.txt" target="_self">`llms.txt`</a>: A concise index of all pages with titles and descriptions
* <a href="/llms-full.txt" target="_self">`llms-full.txt`</a>: Complete documentation content in a single file

### MCP server

Connect the docs as an [MCP server](https://modelcontextprotocol.io) so your agent can search and read pages directly:

::::code-group

```bash [Claude Code]
claude mcp add --transport http mpp https://mpp.tempo.xyz/api/mcp
```

```bash [Codex]
codex mcp add --transport http mpp https://mpp.tempo.xyz/api/mcp
```

```bash [Amp]
amp mcp add --transport http mpp https://mpp.tempo.xyz/api/mcp
```

```json [Manual]
// Claude Code: .mcp.json | Cursor: ~/.cursor/mcp.json
// Windsurf: ~/.codeium/windsurf/mcp_config.json
{
  "mcpServers": {
    "mpp": {
      "url": "https://mpp.tempo.xyz/api/mcp"
    }
  }
}
```

::::

**Available tools:**

| Tool | Description |
| --- | --- |
| `list_pages` | List all documentation pages with their paths |
| `read_page` | Read the content of a specific documentation page |
| `search_docs` | Search documentation for a query string |
| `list_sources` | List available source code repositories |
| `list_source_files` | List files in a directory |
| `read_source_file` | Read a source code file |
| `get_file_tree` | Get a recursive file tree |
| `search_source` | Search source code for a pattern |

# Accept one-time payments \[Charge per request with a payment-gated API]

Build a payment-gated image generation API that charges $0.01 per request using `mppx`.
The server returns a random photo from [Picsum](https://picsum.photos) behind a paywall,
but you could swap in an AI model like [OpenAI Image Generation](https://developers.openai.com/api/reference/resources/images) instead.

## Demo

Try the live payment-gated image generation API running in this command line interface.

<Cli.Demo token={pathUsd} restartStep={1}>
  <Cli.Startup />

  <Cli.ConnectWallet />

  <Cli.Faucet />

  <Cli.Photo />
</Cli.Demo>

## Prompt mode

Paste this into your AI coding agent to build the entire guide in one shot:

```txt
Use https://mpp.dev/guides/one-time-payments.md as reference.
Add mppx to my app with a payment-gated photo endpoint 
that charges $0.01 per request using the Tempo payment method with 
PathUSD. When payment is verified, fetch a random photo from 
https://picsum.photos/1024/1024 and return the URL as JSON.
```

## Manual mode

Select your framework to follow a step-by-step guide. If your framework isn't listed, choose **Other** for a generic [Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API) approach compatible with most TypeScript server frameworks.

<Tabs>
  <Tab title="Next.js">
    ::::steps

    #### Install `mppx`

    :::code-group

    ```bash [npm]
    npm install mppx viem
    ```

    ```bash [pnpm]
    pnpm add mppx viem
    ```

    ```bash [bun]
    bun add mppx viem
    ```

    :::

    #### Set up `Mppx` instance

    Set up an `Mppx` instance with the `tempo` method.

    * `recipient` is the address where you receive payments.
    * `currency` is the token address for payments (in this case, `pathUSD`).

    ```ts [app/api/photo/route.ts]
    import { Mppx, tempo } from 'mppx/nextjs'

    export const mppx = Mppx.create({
      methods: [tempo({
        currency: '0x20c0000000000000000000000000000000000000',
        recipient: '0xa726a1CD723409074DF9108A2187cfA19899aCF8',
      })],
    })
    ```

    #### Create the `/api/photo` route

    Create the photo route. This route is **currently unpaid**.

    ```ts [app/api/photo/route.ts]
    import { Mppx, tempo } from 'mppx/nextjs'

    export const mppx = Mppx.create({
      methods: [tempo({
        currency: '0x20c0000000000000000000000000000000000000',
        recipient: '0xa726a1CD723409074DF9108A2187cfA19899aCF8',
      })],
    })

    // [!code focus:start]
    export const GET = async () => {
      const res = await fetch('https://picsum.photos/1024/1024')
      return Response.json({ url: res.url })
    }
    // [!code focus:end]
    ```

    #### Add `.charge` to the route handler

    Add payment verification using `mppx.charge` as route middleware.
    The handler runs only after payment is verified.

    ```ts [app/api/photo/route.ts]
    import { Mppx, tempo } from 'mppx/nextjs'

    export const mppx = Mppx.create({
      methods: [tempo({
        currency: '0x20c0000000000000000000000000000000000000',
        recipient: '0xa726a1CD723409074DF9108A2187cfA19899aCF8',
      })],
    })

    // [!code focus:start]
    export const GET =
      mppx.charge({ amount: '0.01', description: 'Random stock photo' }) // [!code ++]
      (async () => {
        const res = await fetch('https://picsum.photos/1024/1024')
        return Response.json({ url: res.url })
      })
    // [!code focus:end]
    ```

    #### Test via the `mppx` CLI

    ```bash
    # Create account funded with testnet tokens
    $ npx mppx account create

    # Make a paid request
    $ npx mppx http://localhost:3000/api/photo 
    ```

    ::::
  </Tab>

  <Tab title="Hono">
    ::::steps

    #### Install `mppx` and `hono`

    :::code-group

    ```bash [npm]
    npm install mppx hono viem
    ```

    ```bash [pnpm]
    pnpm add mppx hono viem
    ```

    ```bash [bun]
    bun add mppx hono viem
    ```

    :::

    #### Set up `Mppx` instance

    Set up an `Mppx` instance with the `tempo` method.

    * `recipient` is the address where you receive payments.
    * `currency` is the token address for payments (in this case, `pathUSD`).

    ```ts [server.ts]
    import { Hono } from 'hono'
    import { Mppx, tempo } from 'mppx/hono'

    const app = new Hono()

    const mppx = Mppx.create({
      methods: [tempo({
        currency: '0x20c0000000000000000000000000000000000000',
        recipient: '0xa726a1CD723409074DF9108A2187cfA19899aCF8',
      })],
    })
    ```

    #### Create the `/api/photo` route

    Create the photo route. This route is **currently unpaid**.

    ```ts [server.ts]
    import { Hono } from 'hono'
    import { Mppx, tempo } from 'mppx/hono'

    const app = new Hono()

    const mppx = Mppx.create({
      methods: [tempo({
        currency: '0x20c0000000000000000000000000000000000000',
        recipient: '0xa726a1CD723409074DF9108A2187cfA19899aCF8',
      })],
    })

    // [!code focus:start]
    app.get('/api/photo', async (c) => {
      const res = await fetch('https://picsum.photos/1024/1024')
      return c.json({ url: res.url })
    })
    // [!code focus:end]
    ```

    #### Add `.charge` to the route handler

    Add payment verification using `mppx.charge` as route middleware.
    The handler runs only after payment is verified.

    ```ts [server.ts]
    import { Hono } from 'hono'
    import { Mppx, tempo } from 'mppx/hono'

    const app = new Hono()

    const mppx = Mppx.create({
      methods: [tempo({
        currency: '0x20c0000000000000000000000000000000000000',
        recipient: '0xa726a1CD723409074DF9108A2187cfA19899aCF8',
      })],
    })

    // [!code focus:start]
    app.get(
      '/api/photo',
      mppx.charge({ amount: '0.01', description: 'Random stock photo' }), // [!code ++]
      async (c) => {
        const res = await fetch('https://picsum.photos/1024/1024')
        return c.json({ url: res.url })
      },
    )
    // [!code focus:end]
    ```

    #### Test via the `mppx` CLI

    ```bash
    # Create account funded with testnet tokens
    $ npx mppx account create

    # Make a paid request
    $ npx mppx http://localhost:3000/api/photo 
    ```

    ::::
  </Tab>

  <Tab title="Workers">
    ::::steps

    #### Install `mppx`

    :::code-group

    ```bash [npm]
    npm install mppx viem
    ```

    ```bash [pnpm]
    pnpm add mppx viem
    ```

    ```bash [bun]
    bun add mppx viem
    ```

    :::

    #### Set up `Mppx` instance

    Set up an `Mppx` instance with the `tempo` method.

    * `recipient` is the address where you receive payments.
    * `currency` is the token address for payments (in this case, `pathUSD`).

    ```ts [src/index.ts]
    import { Mppx, tempo } from 'mppx/server'

    const mppx = Mppx.create({
      methods: [tempo({
        currency: '0x20c0000000000000000000000000000000000000',
        recipient: '0xa726a1CD723409074DF9108A2187cfA19899aCF8',
      })],
    })
    ```

    #### Create the `/api/photo` route

    Create the photo route. This route is **currently unpaid**.

    ```ts [src/index.ts]
    import { Mppx, tempo } from 'mppx/server'

    const mppx = Mppx.create({
      methods: [tempo({
        currency: '0x20c0000000000000000000000000000000000000',
        recipient: '0xa726a1CD723409074DF9108A2187cfA19899aCF8',
      })],
    })

    // [!code focus:start]
    export default {
      async fetch(request: Request) {
        const res = await fetch('https://picsum.photos/1024/1024')
        return Response.json({ url: res.url })
      },
    }
    // [!code focus:end]
    ```

    #### Add `.charge` to the route handler

    Add payment verification using `mppx.charge`. If the status is `402`, return the Challenge. Otherwise, fetch the photo and attach a Receipt to the response.

    ```ts [src/index.ts]
    import { Mppx, tempo } from 'mppx/server'

    const mppx = Mppx.create({
      methods: [tempo({
        currency: '0x20c0000000000000000000000000000000000000',
        recipient: '0xa726a1CD723409074DF9108A2187cfA19899aCF8',
      })],
    })

    // [!code focus:start]
    export default {
      async fetch(request: Request) {
        const result = await mppx.charge({ // [!code ++]
          amount: '0.01', // [!code ++]
          description: 'Random stock photo', // [!code ++]
        })(request) // [!code ++]

        if (result.status === 402) return result.challenge // [!code ++]

        const res = await fetch('https://picsum.photos/1024/1024')
        return result.withReceipt(Response.json({ url: res.url })) // [!code ++]
      },
    }
    // [!code focus:end]
    ```

    #### Test via the `mppx` CLI

    ```bash
    # Create account funded with testnet tokens
    $ npx mppx account create

    # Make a paid request
    $ npx mppx http://localhost:8787 
    ```

    ::::
  </Tab>

  <Tab title="Express">
    ::::steps

    #### Install `mppx` and `express`

    :::code-group

    ```bash [npm]
    npm install mppx express viem
    ```

    ```bash [pnpm]
    pnpm add mppx express viem
    ```

    ```bash [bun]
    bun add mppx express viem
    ```

    :::

    #### Set up `Mppx` instance

    Set up an `Mppx` instance with the `tempo` method.

    * `recipient` is the address where you receive payments.
    * `currency` is the token address for payments (in this case, `pathUSD`).

    ```ts [server.ts]
    import express from 'express'
    import { Mppx, tempo } from 'mppx/express'

    const app = express()

    const mppx = Mppx.create({
      methods: [tempo({
        currency: '0x20c0000000000000000000000000000000000000',
        recipient: '0xa726a1CD723409074DF9108A2187cfA19899aCF8',
      })],
    })
    ```

    #### Create the `/api/photo` route

    Create the photo route. This route is **currently unpaid**.

    ```ts [server.ts]
    import express from 'express'
    import { Mppx, tempo } from 'mppx/express'

    const app = express()

    const mppx = Mppx.create({
      methods: [tempo({
        currency: '0x20c0000000000000000000000000000000000000',
        recipient: '0xa726a1CD723409074DF9108A2187cfA19899aCF8',
      })],
    })

    // [!code focus:start]
    app.get('/api/photo', async (req, res) => {
      const response = await fetch('https://picsum.photos/1024/1024')
      res.json({ url: response.url })
    })
    // [!code focus:end]
    ```

    #### Add `.charge` to the route handler

    Add payment verification using `mppx.charge` as route middleware.
    The handler runs only after payment is verified.

    ```ts [server.ts]
    import express from 'express'
    import { Mppx, tempo } from 'mppx/express'

    const app = express()

    const mppx = Mppx.create({
      methods: [tempo({
        currency: '0x20c0000000000000000000000000000000000000',
        recipient: '0xa726a1CD723409074DF9108A2187cfA19899aCF8',
      })],
    })

    // [!code focus:start]
    app.get(
      '/api/photo',
      mppx.charge({ amount: '0.01', description: 'Random stock photo' }), // [!code ++]
      async (req, res) => {
        const response = await fetch('https://picsum.photos/1024/1024')
        res.json({ url: response.url })
      },
    )
    // [!code focus:end]
    ```

    #### Test via the `mppx` CLI

    ```bash
    # Create account funded with testnet tokens
    $ npx mppx account create

    # Make a paid request
    $ npx mppx http://localhost:3000/api/photo 
    ```

    ::::
  </Tab>

  <Tab title="Other">
    This guide walks through using `mppx/server` directly with any [Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API)-compatible framework: [Bun](https://bun.sh), [Deno](https://deno.com), [Cloudflare Workers](https://workers.dev), and others.

    <div className="h-6" />

    ::::steps

    #### Install `mppx`

    :::code-group

    ```bash [npm]
    npm install mppx viem
    ```

    ```bash [pnpm]
    pnpm add mppx viem
    ```

    ```bash [bun]
    bun add mppx viem
    ```

    :::

    #### Set up `Mppx` instance

    Set up an `Mppx` instance with the `tempo` method.

    * `recipient` is the address where you receive payments.
    * `currency` is the token address for payments (in this case, `pathUSD`).

    ```ts [server.ts]
    import { Mppx, tempo } from 'mppx/server'

    const mppx = Mppx.create({
      methods: [tempo({
        currency: '0x20c0000000000000000000000000000000000000',
        recipient: '0xa726a1CD723409074DF9108A2187cfA19899aCF8',
      })],
    })
    ```

    #### Create the `/api/photo` route

    Create the photo route. This route is **currently unpaid**.

    ```ts [server.ts]
    import { Mppx, tempo } from 'mppx/server'

    const mppx = Mppx.create({
      methods: [tempo({
        currency: '0x20c0000000000000000000000000000000000000',
        recipient: '0xa726a1CD723409074DF9108A2187cfA19899aCF8',
      })],
    })

    // [!code focus:start]
    Bun.serve({
      async fetch(request) {
        const res = await fetch('https://picsum.photos/1024/1024')
        return Response.json({ url: res.url })
      },
    })
    // [!code focus:end]
    ```

    #### Add `.charge` to the route handler

    Add payment verification using `mppx.charge`. If the status is `402`, return the Challenge. Otherwise, fetch the photo and attach a Receipt to the response.

    ```ts [server.ts]
    import { Mppx, tempo } from 'mppx/server'

    const mppx = Mppx.create({
      methods: [tempo({
        currency: '0x20c0000000000000000000000000000000000000',
        recipient: '0xa726a1CD723409074DF9108A2187cfA19899aCF8',
      })],
    })

    // [!code focus:start]
    Bun.serve({
      async fetch(request) {
        const result = await mppx.charge({ // [!code ++]
          amount: '0.01', // [!code ++]
          description: 'Random stock photo', // [!code ++]
        })(request) // [!code ++]

        if (result.status === 402) return result.challenge // [!code ++]

        const res = await fetch('https://picsum.photos/1024/1024')
        return result.withReceipt(Response.json({ url: res.url })) // [!code ++]
      },
    })
    // [!code focus:end]
    ```

    #### Test via the `mppx` CLI

    ```bash
    # Create account funded with testnet tokens
    $ npx mppx account create

    # Make a paid request
    $ npx mppx http://localhost:3000
    ```

    ::::
  </Tab>
</Tabs>

## Next steps

<Cards>
  <PayAsYouGoCard />

  <ServerQuickstartCard />

  <PrestoCliCard />
</Cards>

# Accept pay-as-you-go payments \[Session-based billing with payment channels]

Build a payment-gated photo gallery API that charges $0.01 per photo using `mppx` sessions.
The server returns random photos from [Picsum](https://picsum.photos) behind a paywall,
but you could imagine generating images with an AI model instead like [OpenAI Image Generation](https://developers.openai.com/api/reference/resources/images).

:::info
Unlike [one-time payments](/guides/one-time-payments), sessions open a payment channel once and
use offchain vouchers for each subsequent request—vouchers are **not bottlenecked by blockchain throughput**, they are processed in pure CPU-bound signature checks.
:::

## Demo

Try the live payment-gated photo gallery API running in this command line interface.

<Cli.Demo token={pathUsd} restartStep={1}>
  <Cli.Startup />

  <Cli.ConnectWallet />

  <Cli.Faucet />

  <Cli.Gallery />
</Cli.Demo>

## Prompt mode

Paste this into your AI coding agent to build the entire guide in one shot:

```txt
Use https://mpp.dev/guides/pay-as-you-go.md as reference.
Add mppx to my app with a payment-gated gallery endpoint
that charges $0.01 per photo using the Tempo session payment method with
PathUSD. When payment is verified, fetch a random photo from
https://picsum.photos/200/200 and return the URL as JSON.
```

## Manual mode

Select your framework to follow a step-by-step guide. If your framework isn't listed, choose **Other** for a generic [Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API) approach compatible with most TypeScript server frameworks.

<Tabs>
  <Tab title="Next.js">
    ::::steps

    #### Install `mppx`

    :::code-group

    ```bash [npm]
    npm install mppx viem
    ```

    ```bash [pnpm]
    pnpm add mppx viem
    ```

    ```bash [bun]
    bun add mppx viem
    ```

    :::

    #### Set up `Mppx` instance

    Set up an `Mppx` instance with the `tempo` method.

    * `recipient` is the address where you receive payments.
    * `currency` is the token address for payments (in this case, `pathUSD`).

    ```ts [app/api/sessions/photo/route.ts]
    import { Mppx, tempo } from 'mppx/nextjs'

    export const mppx = Mppx.create({
      methods: [tempo({
        currency: '0x20c0000000000000000000000000000000000000',
        recipient: '0xa726a1CD723409074DF9108A2187cfA19899aCF8',
      })],
    })
    ```

    #### Create the `/api/sessions/photo` route

    Create the gallery route. This route is **currently unpaid**.

    ```ts [app/api/sessions/photo/route.ts]
    import { Mppx, tempo } from 'mppx/nextjs'

    export const mppx = Mppx.create({
      methods: [tempo({
        currency: '0x20c0000000000000000000000000000000000000',
        recipient: '0xa726a1CD723409074DF9108A2187cfA19899aCF8',
      })],
    })

    // [!code focus:start]
    export const GET = async () => {
      const res = await fetch('https://picsum.photos/200/200')
      return Response.json({ url: res.url })
    }
    // [!code focus:end]
    ```

    #### Add `.session` to the route handler

    Add payment verification using `mppx.session` as route middleware.
    The handler runs only after payment is verified.

    ```ts [app/api/sessions/photo/route.ts]
    import { Mppx, tempo } from 'mppx/nextjs'

    export const mppx = Mppx.create({
      methods: [tempo({
        currency: '0x20c0000000000000000000000000000000000000',
        recipient: '0xa726a1CD723409074DF9108A2187cfA19899aCF8',
      })],
    })

    // [!code focus:start]
    export const GET =
      mppx.session({ amount: '0.01', unitType: 'photo' }) // [!code ++]
      (async () => {
        const res = await fetch('https://picsum.photos/200/200')
        return Response.json({ url: res.url })
      })
    // [!code focus:end]
    ```

    #### Test via the `mppx` CLI

    ```bash
    # Create account funded with testnet tokens
    $ npx mppx account create

    # Make a paid request
    $ npx mppx http://localhost:3000/api/sessions/photo 
    ```

    ::::
  </Tab>

  <Tab title="Hono">
    ::::steps

    #### Install `mppx` and `hono`

    :::code-group

    ```bash [npm]
    npm install mppx hono viem
    ```

    ```bash [pnpm]
    pnpm add mppx hono viem
    ```

    ```bash [bun]
    bun add mppx hono viem
    ```

    :::

    #### Set up `Mppx` instance

    Set up an `Mppx` instance with the `tempo` method.

    * `recipient` is the address where you receive payments.
    * `currency` is the token address for payments (in this case, `pathUSD`).

    ```ts [server.ts]
    import { Hono } from 'hono'
    import { Mppx, tempo } from 'mppx/hono'

    const app = new Hono()

    const mppx = Mppx.create({
      methods: [tempo({
        currency: '0x20c0000000000000000000000000000000000000',
        recipient: '0xa726a1CD723409074DF9108A2187cfA19899aCF8',
      })],
    })
    ```

    #### Create the `/api/sessions/photo` route

    Create the gallery route. This route is **currently unpaid**.

    ```ts [server.ts]
    import { Hono } from 'hono'
    import { Mppx, tempo } from 'mppx/hono'

    const app = new Hono()

    const mppx = Mppx.create({
      methods: [tempo({
        currency: '0x20c0000000000000000000000000000000000000',
        recipient: '0xa726a1CD723409074DF9108A2187cfA19899aCF8',
      })],
    })

    // [!code focus:start]
    app.get('/api/sessions/photo', async (c) => {
      const res = await fetch('https://picsum.photos/200/200')
      return c.json({ url: res.url })
    })
    // [!code focus:end]
    ```

    #### Add `.session` to the route handler

    Add payment verification using `mppx.session` as route middleware.
    The handler runs only after payment is verified.

    ```ts [server.ts]
    import { Hono } from 'hono'
    import { Mppx, tempo } from 'mppx/hono'

    const app = new Hono()

    const mppx = Mppx.create({
      methods: [tempo({
        currency: '0x20c0000000000000000000000000000000000000',
        recipient: '0xa726a1CD723409074DF9108A2187cfA19899aCF8',
      })],
    })

    // [!code focus:start]
    app.get(
      '/api/sessions/photo',
      mppx.session({ amount: '0.01', unitType: 'photo' }), // [!code ++]
      async (c) => {
        const res = await fetch('https://picsum.photos/200/200')
        return c.json({ url: res.url })
      },
    )
    // [!code focus:end]
    ```

    #### Test via the `mppx` CLI

    ```bash
    # Create account funded with testnet tokens
    $ npx mppx account create

    # Make a paid request
    $ npx mppx http://localhost:3000/api/sessions/photo 
    ```

    ::::
  </Tab>

  <Tab title="Workers">
    ::::steps

    #### Install `mppx`

    :::code-group

    ```bash [npm]
    npm install mppx viem
    ```

    ```bash [pnpm]
    pnpm add mppx viem
    ```

    ```bash [bun]
    bun add mppx viem
    ```

    :::

    #### Set up `Mppx` instance

    Set up an `Mppx` instance with the `tempo` method.

    * `recipient` is the address where you receive payments.
    * `currency` is the token address for payments (in this case, `pathUSD`).

    ```ts [src/index.ts]
    import { Mppx, tempo } from 'mppx/server'

    const mppx = Mppx.create({
      methods: [tempo({
        currency: '0x20c0000000000000000000000000000000000000',
        recipient: '0xa726a1CD723409074DF9108A2187cfA19899aCF8',
      })],
    })
    ```

    #### Create the gallery route

    Create the gallery route. This route is **currently unpaid**.

    ```ts [src/index.ts]
    import { Mppx, tempo } from 'mppx/server'

    const mppx = Mppx.create({
      methods: [tempo({
        currency: '0x20c0000000000000000000000000000000000000',
        recipient: '0xa726a1CD723409074DF9108A2187cfA19899aCF8',
      })],
    })

    // [!code focus:start]
    export default {
      async fetch(request: Request) {
        const res = await fetch('https://picsum.photos/200/200')
        return Response.json({ url: res.url })
      },
    }
    // [!code focus:end]
    ```

    #### Add `.session` to the route handler

    Add payment verification using `mppx.session`. If the status is `402`, return the Challenge. Otherwise, fetch the photo and attach a Receipt to the response.

    ```ts [src/index.ts]
    import { Mppx, tempo } from 'mppx/server'

    const mppx = Mppx.create({
      methods: [tempo({
        currency: '0x20c0000000000000000000000000000000000000',
        recipient: '0xa726a1CD723409074DF9108A2187cfA19899aCF8',
      })],
    })

    // [!code focus:start]
    export default {
      async fetch(request: Request) {
        const result = await mppx.session({ // [!code ++]
          amount: '0.01', // [!code ++]
          unitType: 'photo', // [!code ++]
        })(request) // [!code ++]

        if (result.status === 402) return result.challenge // [!code ++]

        const res = await fetch('https://picsum.photos/200/200')
        return result.withReceipt(Response.json({ url: res.url })) // [!code ++]
      },
    }
    // [!code focus:end]
    ```

    #### Test via the `mppx` CLI

    ```bash
    # Create account funded with testnet tokens
    $ npx mppx account create

    # Make a paid request
    $ npx mppx http://localhost:8787 
    ```

    ::::
  </Tab>

  <Tab title="Express">
    ::::steps

    #### Install `mppx` and `express`

    :::code-group

    ```bash [npm]
    npm install mppx express viem
    ```

    ```bash [pnpm]
    pnpm add mppx express viem
    ```

    ```bash [bun]
    bun add mppx express viem
    ```

    :::

    #### Set up `Mppx` instance

    Set up an `Mppx` instance with the `tempo` method.

    * `recipient` is the address where you receive payments.
    * `currency` is the token address for payments (in this case, `pathUSD`).

    ```ts [server.ts]
    import express from 'express'
    import { Mppx, tempo } from 'mppx/express'

    const app = express()

    const mppx = Mppx.create({
      methods: [tempo({
        currency: '0x20c0000000000000000000000000000000000000',
        recipient: '0xa726a1CD723409074DF9108A2187cfA19899aCF8',
      })],
    })
    ```

    #### Create the `/api/sessions/photo` route

    Create the gallery route. This route is **currently unpaid**.

    ```ts [server.ts]
    import express from 'express'
    import { Mppx, tempo } from 'mppx/express'

    const app = express()

    const mppx = Mppx.create({
      methods: [tempo({
        currency: '0x20c0000000000000000000000000000000000000',
        recipient: '0xa726a1CD723409074DF9108A2187cfA19899aCF8',
      })],
    })

    // [!code focus:start]
    app.get('/api/sessions/photo', async (req, res) => {
      const response = await fetch('https://picsum.photos/200/200')
      res.json({ url: response.url })
    })
    // [!code focus:end]
    ```

    #### Add `.session` to the route handler

    Add payment verification using `mppx.session` as route middleware.
    The handler runs only after payment is verified.

    ```ts [server.ts]
    import express from 'express'
    import { Mppx, tempo } from 'mppx/express'

    const app = express()

    const mppx = Mppx.create({
      methods: [tempo({
        currency: '0x20c0000000000000000000000000000000000000',
        recipient: '0xa726a1CD723409074DF9108A2187cfA19899aCF8',
      })],
    })

    // [!code focus:start]
    app.get(
      '/api/sessions/photo',
      mppx.session({ amount: '0.01', unitType: 'photo' }), // [!code ++]
      async (req, res) => {
        const response = await fetch('https://picsum.photos/200/200')
        res.json({ url: response.url })
      },
    )
    // [!code focus:end]
    ```

    #### Test via the `mppx` CLI

    ```bash
    # Create account funded with testnet tokens
    $ npx mppx account create

    # Make a paid request
    $ npx mppx http://localhost:3000/api/sessions/photo 
    ```

    ::::
  </Tab>

  <Tab title="Other">
    This guide walks through using `mppx/server` directly with any [Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API)-compatible framework: [Bun](https://bun.sh), [Deno](https://deno.com), [Cloudflare Workers](https://workers.dev), and others.

    <div className="h-6" />

    ::::steps

    #### Install `mppx`

    :::code-group

    ```bash [npm]
    npm install mppx viem
    ```

    ```bash [pnpm]
    pnpm add mppx viem
    ```

    ```bash [bun]
    bun add mppx viem
    ```

    :::

    #### Set up `Mppx` instance

    Set up an `Mppx` instance with the `tempo` method.

    * `recipient` is the address where you receive payments.
    * `currency` is the token address for payments (in this case, `pathUSD`).

    ```ts [server.ts]
    import { Mppx, tempo } from 'mppx/server'

    const mppx = Mppx.create({
      methods: [tempo({
        currency: '0x20c0000000000000000000000000000000000000',
        recipient: '0xa726a1CD723409074DF9108A2187cfA19899aCF8',
      })],
    })
    ```

    #### Create the `/api/sessions/photo` route

    Create the gallery route. This route is **currently unpaid**.

    ```ts [server.ts]
    import { Mppx, tempo } from 'mppx/server'

    const mppx = Mppx.create({
      methods: [tempo({
        currency: '0x20c0000000000000000000000000000000000000',
        recipient: '0xa726a1CD723409074DF9108A2187cfA19899aCF8',
      })],
    })

    // [!code focus:start]
    Bun.serve({
      async fetch(request) {
        const res = await fetch('https://picsum.photos/200/200')
        return Response.json({ url: res.url })
      },
    })
    // [!code focus:end]
    ```

    #### Add `.session` to the route handler

    Add payment verification using `mppx.session`. If the status is `402`, return the Challenge. Otherwise, fetch the photo and attach a Receipt to the response.

    ```ts [server.ts]
    import { Mppx, tempo } from 'mppx/server'

    const mppx = Mppx.create({
      methods: [tempo({
        currency: '0x20c0000000000000000000000000000000000000',
        recipient: '0xa726a1CD723409074DF9108A2187cfA19899aCF8',
      })],
    })

    // [!code focus:start]
    Bun.serve({
      async fetch(request) {
        const result = await mppx.session({ // [!code ++]
          amount: '0.01', // [!code ++]
          unitType: 'photo', // [!code ++]
        })(request) // [!code ++]

        if (result.status === 402) return result.challenge // [!code ++]

        const res = await fetch('https://picsum.photos/200/200')
        return result.withReceipt(Response.json({ url: res.url })) // [!code ++]
      },
    })
    // [!code focus:end]
    ```

    #### Test via the `mppx` CLI

    ```bash
    # Create account funded with testnet tokens
    $ npx mppx account create

    # Make a paid request
    $ npx mppx http://localhost:3000
    ```

    ::::
  </Tab>
</Tabs>

## Client setup

When using sessions from a client, set `maxDeposit` to enable automatic channel management. This is the maximum amount of tokens the client locks into the payment channel's escrow contract. Any unspent deposit is refunded when the channel closes.

```ts [client.ts]
import { Mppx, tempo } from 'mppx/client'
import { privateKeyToAccount } from 'viem/accounts'

const mppx = Mppx.create({
  methods: [tempo({
    account: privateKeyToAccount('0x...'),
    maxDeposit: '1', // Lock up to 1 pathUSD per channel
  })],
})

// Each fetch automatically manages the session lifecycle:
// 1st request: opens channel on-chain, sends initial voucher
// 2nd+ requests: sends off-chain vouchers (no on-chain tx)
const res = await fetch('http://localhost:3000/api/sessions/photo')
```

* **`maxDeposit: '1'`** — Locks up to 1 pathUSD into the payment channel. At $0.01/photo, this covers up to 100 requests before the channel runs out.
* The client handles the full session lifecycle automatically: channel open, voucher signing, and retry after `402` responses.
* If the server sets `suggestedDeposit`, the client uses `min(suggestedDeposit, maxDeposit)`.

## Next steps

<Cards>
  <OneTimePaymentsCard />

  <ServerQuickstartCard />

  <PrestoCliCard />
</Cards>

# Accept streamed payments \[Per-token billing over Server-Sent Events]

Build a payment-gated poetry API that streams poems word-by-word and charges $0.001 per word using `mppx` sessions with Server-Sent Events (SSE).

:::info
Streamed payments extend [pay-as-you-go sessions](/guides/pay-as-you-go) with SSE. The server charges per token as content streams—if the channel balance runs out mid-stream, the client automatically sends a new voucher and the stream resumes.
:::

## Demo

Try the live payment-gated poetry API running in this command line interface.

<Cli.Demo token={pathUsd} restartStep={1}>
  <Cli.Startup />

  <Cli.ConnectWallet />

  <Cli.Faucet />

  <Cli.Poem />
</Cli.Demo>

## Prompt mode

Paste this into your AI coding agent to build the entire guide in one shot:

```txt
Use https://mpp.dev/guides/streamed-payments.md as reference.
Add mppx to my app with a payment-gated SSE endpoint
that streams text word-by-word and charges $0.001 per word using the
Tempo session payment method with PathUSD and sse: true.
```

## Manual mode

Select your framework to follow a step-by-step guide. If your framework isn't listed, choose **Other** for a generic [Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API) approach compatible with most TypeScript server frameworks.

<Tabs>
  <Tab title="Next.js">
    ::::steps

    #### Install `mppx`

    :::code-group

    ```bash [npm]
    npm install mppx viem
    ```

    ```bash [pnpm]
    pnpm add mppx viem
    ```

    ```bash [bun]
    bun add mppx viem
    ```

    :::

    #### Set up `Mppx` instance with streaming

    Set up an `Mppx` instance with `sse: true` to enable SSE support on the session method.

    ```ts [app/api/sessions/poem/route.ts]
    import { Mppx, tempo } from 'mppx/nextjs'

    export const mppx = Mppx.create({
      methods: [tempo({
        currency: '0x20c0000000000000000000000000000000000000',
        recipient: '0xa726a1CD723409074DF9108A2187cfA19899aCF8',
        sse: true,
      })],
    })
    ```

    #### Create the `/api/sessions/poem` route

    Create the poem route. The `withReceipt` method accepts an async generator—each yielded value is one SSE event and one charged word.

    ```ts [app/api/sessions/poem/route.ts]
    import { Mppx, tempo } from 'mppx/nextjs'

    export const mppx = Mppx.create({
      methods: [tempo({
        currency: '0x20c0000000000000000000000000000000000000',
        recipient: '0xa726a1CD723409074DF9108A2187cfA19899aCF8',
        sse: true,
      })],
    })

    // [!code focus:start]
    const poem = {
      title: 'The Road Not Taken',
      author: 'Robert Frost',
      lines: [
        'Two roads diverged in a yellow wood,',
        'And sorry I could not travel both',
        'And be one traveler, long I stood',
        'And looked down one as far as I could',
        'To where it bent in the undergrowth;',
      ],
    }

    export const GET =
      mppx.session({ amount: '0.001', unitType: 'word' })
      (async () => {
        const words = poem.lines.flatMap(line => [...line.split(' '), '\\n'])
        return async function* (stream) {
          yield JSON.stringify({ title: poem.title, author: poem.author })
          for (const word of words) {
            await stream.charge()
            yield word
          }
        }
      })
    // [!code focus:end]
    ```

    #### Test via the `mppx` CLI

    ```bash
    # Create account funded with testnet tokens
    $ npx mppx account create

    # Stream a paid poem
    $ npx mppx http://localhost:3000/api/sessions/poem
    ```

    ::::
  </Tab>

  <Tab title="Hono">
    ::::steps

    #### Install `mppx` and `hono`

    :::code-group

    ```bash [npm]
    npm install mppx hono viem
    ```

    ```bash [pnpm]
    pnpm add mppx hono viem
    ```

    ```bash [bun]
    bun add mppx hono viem
    ```

    :::

    #### Set up `Mppx` instance with streaming

    Set up an `Mppx` instance with `sse: true` to enable SSE support on the session method.

    ```ts [server.ts]
    import { Hono } from 'hono'
    import { Mppx, tempo } from 'mppx/hono'

    const app = new Hono()

    const mppx = Mppx.create({
      methods: [tempo({
        currency: '0x20c0000000000000000000000000000000000000',
        recipient: '0xa726a1CD723409074DF9108A2187cfA19899aCF8',
        sse: true,
      })],
    })
    ```

    #### Create the `/api/sessions/poem` route

    Create the poem route with the session middleware. The handler returns an async generator—each yielded value is one SSE event and one charged word.

    ```ts [server.ts]
    import { Hono } from 'hono'
    import { Mppx, tempo } from 'mppx/hono'

    const app = new Hono()

    const mppx = Mppx.create({
      methods: [tempo({
        currency: '0x20c0000000000000000000000000000000000000',
        recipient: '0xa726a1CD723409074DF9108A2187cfA19899aCF8',
        sse: true,
      })],
    })

    // [!code focus:start]
    const poem = {
      title: 'The Road Not Taken',
      author: 'Robert Frost',
      lines: [
        'Two roads diverged in a yellow wood,',
        'And sorry I could not travel both',
        'And be one traveler, long I stood',
        'And looked down one as far as I could',
        'To where it bent in the undergrowth;',
      ],
    }

    app.get(
      '/api/sessions/poem',
      mppx.session({ amount: '0.001', unitType: 'word' }),
      async (c) => {
        const words = poem.lines.flatMap(line => [...line.split(' '), '\\n'])
        return async function* (stream) {
          yield JSON.stringify({ title: poem.title, author: poem.author })
          for (const word of words) {
            await stream.charge()
            yield word
          }
        }
      },
    )
    // [!code focus:end]
    ```

    #### Test via the `mppx` CLI

    ```bash
    # Create account funded with testnet tokens
    $ npx mppx account create

    # Stream a paid poem
    $ npx mppx http://localhost:3000/api/sessions/poem
    ```

    ::::
  </Tab>

  <Tab title="Workers">
    ::::steps

    #### Install `mppx`

    :::code-group

    ```bash [npm]
    npm install mppx viem
    ```

    ```bash [pnpm]
    pnpm add mppx viem
    ```

    ```bash [bun]
    bun add mppx viem
    ```

    :::

    #### Set up `Mppx` instance with streaming

    Set up an `Mppx` instance with `sse: true` to enable SSE support on the session method.

    ```ts [src/index.ts]
    import { Mppx, tempo } from 'mppx/server'

    const mppx = Mppx.create({
      methods: [tempo({
        currency: '0x20c0000000000000000000000000000000000000',
        recipient: '0xa726a1CD723409074DF9108A2187cfA19899aCF8',
        sse: true,
      })],
    })
    ```

    #### Create the `/api/sessions/poem` route

    Create the poem route. The `withReceipt` method accepts an async generator—each yielded value is one SSE event and one charged word.

    ```ts [src/index.ts]
    import { Mppx, tempo } from 'mppx/server'

    const mppx = Mppx.create({
      methods: [tempo({
        currency: '0x20c0000000000000000000000000000000000000',
        recipient: '0xa726a1CD723409074DF9108A2187cfA19899aCF8',
        sse: true,
      })],
    })

    // [!code focus:start]
    const poem = {
      title: 'The Road Not Taken',
      author: 'Robert Frost',
      lines: [
        'Two roads diverged in a yellow wood,',
        'And sorry I could not travel both',
        'And be one traveler, long I stood',
        'And looked down one as far as I could',
        'To where it bent in the undergrowth;',
      ],
    }

    export default {
      async fetch(request: Request) {
        const result = await mppx.session({
          amount: '0.001',
          unitType: 'word',
        })(request)

        if (result.status === 402) return result.challenge

        const words = poem.lines.flatMap(line => [...line.split(' '), '\\n'])
        return result.withReceipt(async function* (stream) {
          yield JSON.stringify({ title: poem.title, author: poem.author })
          for (const word of words) {
            await stream.charge()
            yield word
          }
        })
      },
    }
    // [!code focus:end]
    ```

    #### Test via the `mppx` CLI

    ```bash
    # Create account funded with testnet tokens
    $ npx mppx account create

    # Stream a paid poem
    $ npx mppx http://localhost:8787
    ```

    ::::
  </Tab>

  <Tab title="Express">
    ::::steps

    #### Install `mppx` and `express`

    :::code-group

    ```bash [npm]
    npm install mppx express viem
    ```

    ```bash [pnpm]
    pnpm add mppx express viem
    ```

    ```bash [bun]
    bun add mppx express viem
    ```

    :::

    #### Set up `Mppx` instance with streaming

    Set up an `Mppx` instance with `sse: true` to enable SSE support on the session method.

    ```ts [server.ts]
    import express from 'express'
    import { Mppx, tempo } from 'mppx/express'

    const app = express()

    const mppx = Mppx.create({
      methods: [tempo({
        currency: '0x20c0000000000000000000000000000000000000',
        recipient: '0xa726a1CD723409074DF9108A2187cfA19899aCF8',
        sse: true,
      })],
    })
    ```

    #### Create the `/api/sessions/poem` route

    Create the poem route with the session middleware. The handler returns an async generator—each yielded value is one SSE event and one charged word.

    ```ts [server.ts]
    import express from 'express'
    import { Mppx, tempo } from 'mppx/express'

    const app = express()

    const mppx = Mppx.create({
      methods: [tempo({
        currency: '0x20c0000000000000000000000000000000000000',
        recipient: '0xa726a1CD723409074DF9108A2187cfA19899aCF8',
        sse: true,
      })],
    })

    // [!code focus:start]
    const poem = {
      title: 'The Road Not Taken',
      author: 'Robert Frost',
      lines: [
        'Two roads diverged in a yellow wood,',
        'And sorry I could not travel both',
        'And be one traveler, long I stood',
        'And looked down one as far as I could',
        'To where it bent in the undergrowth;',
      ],
    }

    app.get(
      '/api/sessions/poem',
      mppx.session({ amount: '0.001', unitType: 'word' }),
      async (req, res) => {
        const words = poem.lines.flatMap(line => [...line.split(' '), '\\n'])
        return async function* (stream) {
          yield JSON.stringify({ title: poem.title, author: poem.author })
          for (const word of words) {
            await stream.charge()
            yield word
          }
        }
      },
    )
    // [!code focus:end]
    ```

    #### Test via the `mppx` CLI

    ```bash
    # Create account funded with testnet tokens
    $ npx mppx account create

    # Stream a paid poem
    $ npx mppx http://localhost:3000/api/sessions/poem
    ```

    ::::
  </Tab>

  <Tab title="Other">
    This guide walks through using `mppx/server` directly with any [Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API)-compatible framework: [Bun](https://bun.sh), [Deno](https://deno.com), [Cloudflare Workers](https://workers.dev), and others.

    <div className="h-6" />

    ::::steps

    #### Install `mppx`

    :::code-group

    ```bash [npm]
    npm install mppx viem
    ```

    ```bash [pnpm]
    pnpm add mppx viem
    ```

    ```bash [bun]
    bun add mppx viem
    ```

    :::

    #### Set up `Mppx` instance with streaming

    Set up an `Mppx` instance with `sse: true` to enable SSE support on the session method.

    ```ts [server.ts]
    import { Mppx, tempo } from 'mppx/server'

    const mppx = Mppx.create({
      methods: [tempo({
        currency: '0x20c0000000000000000000000000000000000000',
        recipient: '0xa726a1CD723409074DF9108A2187cfA19899aCF8',
        sse: true,
      })],
    })
    ```

    #### Create the streaming poem route

    Create the route handler. `withReceipt` accepts an async generator—each yielded value becomes one SSE `event: message` and is charged one tick (`$0.001`). If the channel balance runs out mid-stream, the server emits `event: payment-need-voucher` and pauses until the client sends a new voucher.

    ```ts [server.ts]
    import { Mppx, tempo } from 'mppx/server'

    const mppx = Mppx.create({
      methods: [tempo({
        currency: '0x20c0000000000000000000000000000000000000',
        recipient: '0xa726a1CD723409074DF9108A2187cfA19899aCF8',
        sse: true,
      })],
    })

    // [!code focus:start]
    const poem = {
      title: 'The Road Not Taken',
      author: 'Robert Frost',
      lines: [
        'Two roads diverged in a yellow wood,',
        'And sorry I could not travel both',
        'And be one traveler, long I stood',
        'And looked down one as far as I could',
        'To where it bent in the undergrowth;',
      ],
    }

    Bun.serve({
      async fetch(request) {
        const result = await mppx.session({
          amount: '0.001',
          unitType: 'word',
        })(request)

        if (result.status === 402) return result.challenge

        const words = poem.lines.flatMap(line => [...line.split(' '), '\\n'])
        return result.withReceipt(async function* (stream) {
          yield JSON.stringify({ title: poem.title, author: poem.author })
          for (const word of words) {
            await stream.charge()
            yield word
          }
        })
      },
    })
    // [!code focus:end]
    ```

    #### Test via the `mppx` CLI

    ```bash
    # Create account funded with testnet tokens
    $ npx mppx account create

    # Stream a paid poem
    $ npx mppx http://localhost:3000
    ```

    ::::
  </Tab>
</Tabs>

## Client setup

Use `tempo.session()` from `mppx/client` to create a session manager. The `.sse()` method connects to the SSE endpoint and handles voucher renewal automatically—if the server requests a new voucher mid-stream, the client signs and sends one without interrupting the stream.

```ts [client.ts]
import { tempo } from 'mppx/client'
import { privateKeyToAccount } from 'viem/accounts'

const session = tempo.session({
  account: privateKeyToAccount('0x...'),
  maxDeposit: '1', // Lock up to 1 pathUSD per channel
})

// .sse() returns an async iterable of SSE data payloads
const stream = await session.sse('http://localhost:3000/api/sessions/poem')

for await (const word of stream) {
  process.stdout.write(word + ' ')
}
```

* **`tempo.session()`** — Creates a session manager that handles the full channel lifecycle: open, voucher signing, and close.
* **`.sse()`** — Connects to an SSE endpoint. Automatically sends new vouchers when the server emits `payment-need-voucher` events.
* **`maxDeposit: '1'`** — Locks up to 1 pathUSD. At $0.001/word, this covers ~1,000 words before the channel needs a top-up.

## Next steps

<Cards>
  <OneTimePaymentsCard />

  <PayAsYouGoCard />

  <PrestoCliCard />
</Cards>

# Charge \[Immediate one-time payments]

The `charge` intent requests an immediate one-time payment. The client pays a fixed amount and the server settles the transaction before returning the response. This is the simplest MPP payment pattern—one request, one payment, one receipt.

## How it works

<MermaidDiagram
  chart={`sequenceDiagram
  participant Client
  participant Server
  participant Network as Payment Network
  Client->>Server: (1) GET /resource
  Server-->>Client: (2) 402 + Challenge
  Note over Client: (3) Fulfill payment
  Client->>Server: (4) GET /resource + Credential
  Server->>Network: (5) Settle payment
  Network-->>Server: (6) Confirmed
  Server-->>Client: (7) 200 OK + Receipt
`}
/>

1. **Client:** requests a paid resource
2. **Server:** responds with `402` and a Challenge specifying the payment requirements—`amount`, `currency`, and `recipient`
3. **Client:** fulfills the payment using the method specified in the Challenge
4. **Client:** retries the request with the payment proof as a Credential
5. **Server:** verifies the Credential and settles the payment on the underlying network
6. **Network:** confirms the payment
7. **Server:** returns the resource with a Receipt

## When to use charge

Charge is the best intent when each request maps to a single payment with a known cost:

* **Paid API endpoints**—Charge per request for data, compute, or content
* **Content access**—Pay-per-article, pay-per-query, or pay-per-download
* **Tool calls**—MCP tool invocations where each call has a fixed price
* **Simple integrations**—No channel setup, no state management, no storage backend

For metered billing, high volume flows such as scraping, or usage-based billing where the total cost isn't known upfront, use the session intent instead.

## Request schema

The charge intent defines the following request fields:

| Field | Type | Required | Description |
|---|---|---|---|
| `amount` | string | Required | Payment amount in base units |
| `currency` | string | Required | Currency identifier (token address, currency code) |
| `description` | string | Optional | Human-readable description of the payment |
| `expires` | string | Optional | ISO 8601 expiry timestamp |
| `externalId` | string | Optional | Server-defined idempotency key |
| `recipient` | string | Optional | Recipient identifier (address, account ID) |

Payment methods extend this schema with method-specific fields through `methodDetails`. For example, Tempo adds `chainId` and `feePayer`.

## Method integrations

Each payment method defines how charge is fulfilled, verified, and settled on its underlying network.

<Cards>
  <TempoChargeCard />

  <StripeMethodCard />
</Cards>

## Specification

<Cards>
  <SpecCard to="https://tempoxyz.github.io/mpp-specs/draft-payment-intent-charge-00" />
</Cards>

# Custom \[Build your own payment method]

The `mppx` SDK supports dynamic extensibility for new payment methods. You can implement custom payment methods to integrate any payment rails such as other blockchains, card processors, or proprietary systems.

## Overview

A custom payment method requires:

1. **Method definition:** Define the method name, intent, and schemas for request parameters and Credential payloads
2. **Client logic:** Create Credentials when the client gets a `402` response
3. **Server logic:** Verify Credentials and return Receipts

## Define a method

Start by defining your payment method with `Method.from`. The definition includes the method name, intent type, and schemas for request parameters and Credential payloads.

```ts twoslash
import { Method, z } from 'mppx'

const lightning = Method.from({
  intent: 'charge',
  name: 'lightning',
  schema: {
    credential: {
      payload: z.object({
        preimage: z.string(),
      }),
    },
    request: z.object({
      amount: z.string(),
      currency: z.string(),
      invoice: z.string(),
      paymentHash: z.string(),
      recipient: z.string(),
    }),
  },
})
```

## Client implementation

Extend the method with Credential creation logic using `Method.toClient`. The `createCredential` function runs when the client gets a `402` response:

```ts twoslash
import { Credential, Method, z } from 'mppx'

const lightning = Method.from({
  intent: 'charge',
  name: 'lightning',
  schema: {
    credential: {
      payload: z.object({
        preimage: z.string(),
      }),
    },
    request: z.object({
      amount: z.string(),
      currency: z.string(),
      invoice: z.string(),
      paymentHash: z.string(),
      recipient: z.string(),
    }),
  },
})

declare function payInvoice(invoice: string): Promise<{ preimage: string }>
// ---cut---
const clientMethod = Method.toClient(lightning, {
  async createCredential({ challenge }) {
    const result = await payInvoice(challenge.request.invoice)

    return Credential.serialize({
      challenge,
      payload: {
        preimage: result.preimage,
      },
    })
  },
})
```

## Server implementation

Extend the method with verification logic using `Method.toServer`. For Lightning Network, verify that the preimage hashes to the payment hash:

```ts twoslash
import { Method, Receipt, z } from 'mppx'

const lightning = Method.from({
  intent: 'charge',
  name: 'lightning',
  schema: {
    credential: {
      payload: z.object({
        preimage: z.string(),
      }),
    },
    request: z.object({
      amount: z.string(),
      currency: z.string(),
      invoice: z.string(),
      paymentHash: z.string(),
      recipient: z.string(),
    }),
  },
})

declare function bytesToHex(bytes: Uint8Array): string
declare function hexToBytes(hex: string): Uint8Array
declare function sha256(data: Uint8Array): Uint8Array
// ---cut---
const serverMethod = Method.toServer(lightning, {
  async verify({ credential }) {
    const preimage = credential.payload.preimage
    const expectedHash = credential.challenge.request.paymentHash

    const actualHash = bytesToHex(sha256(hexToBytes(preimage)))
    const isValid = actualHash === expectedHash

    return Receipt.from({
      method: 'lightning',
      reference: preimage,
      status: 'success',
      timestamp: new Date().toISOString(),
    })
  },
})
```

## Use in your app

### Client

Pass the client method to `Mppx.create`:

```ts twoslash
import { Credential, Method, z } from 'mppx'
import { Mppx } from 'mppx/client'

const lightning = Method.from({
  intent: 'charge',
  name: 'lightning',
  schema: {
    credential: {
      payload: z.object({
        preimage: z.string(),
      }),
    },
    request: z.object({
      amount: z.string(),
      currency: z.string(),
      invoice: z.string(),
      paymentHash: z.string(),
      recipient: z.string(),
    }),
  },
})

declare function payInvoice(invoice: string): Promise<{ preimage: string }>

const clientMethod = Method.toClient(lightning, {
  async createCredential({ challenge }) {
    const result = await payInvoice(challenge.request.invoice)

    return Credential.serialize({
      challenge,
      payload: {
        preimage: result.preimage,
      },
    })
  },
})
// ---cut---
const { fetch } = Mppx.create({
  methods: [clientMethod],
  polyfill: false,
})

const response = await fetch('https://api.example.com/premium')
```

### Server

Pass the server method to `Mppx.create`:

```ts twoslash
import { Method, Receipt, z } from 'mppx'
import { Mppx } from 'mppx/server'

const lightning = Method.from({
  intent: 'charge',
  name: 'lightning',
  schema: {
    credential: {
      payload: z.object({
        preimage: z.string(),
      }),
    },
    request: z.object({
      amount: z.string(),
      currency: z.string(),
      invoice: z.string(),
      paymentHash: z.string(),
      recipient: z.string(),
    }),
  },
})

declare function bytesToHex(bytes: Uint8Array): string
declare function hexToBytes(hex: string): Uint8Array
declare function sha256(data: Uint8Array): Uint8Array

const serverMethod = Method.toServer(lightning, {
  async verify({ credential }) {
    const preimage = credential.payload.preimage
    const expectedHash = credential.challenge.request.paymentHash

    const actualHash = bytesToHex(sha256(hexToBytes(preimage)))
    const isValid = actualHash === expectedHash

    return Receipt.from({
      method: 'lightning',
      reference: preimage,
      status: 'success',
      timestamp: new Date().toISOString(),
    })
  },
})
// ---cut---
const mppx = Mppx.create({
  methods: [serverMethod],
})
```

## SDK references

* [`Method.from`](/sdk/typescript/Method.from)—Define a payment method with schemas
* [`Method.toClient`](/sdk/typescript/core/Method.toClient)—Extend a method with client-side Credential creation logic
* [`Method.toServer`](/sdk/typescript/core/Method.toServer)—Extend a method with server-side verification logic

# Stripe \[Cards, wallets, and other Stripe supported payment methods]

The Stripe payment method enables payments using [Stripe Payment Tokens (SPTs)](https://docs.stripe.com/agentic-commerce/concepts/shared-payment-tokens)—single-use tokens that represent payment authorization. SPTs abstract payment method details (cards, wallets) and provide a unified interface for payment acceptance.

Both the client and server need a Stripe account. The client creates an SPT using the Stripe API or Stripe.js, and the server consumes it to create a Stripe `PaymentIntent`.

## How it works

1. **Server:** responds with `402` and a Challenge containing the amount, currency, and Stripe method details (Business Network profile, allowed payment method types).
2. **Client:** creates an SPT with Stripe and sends a Credential containing the SPT.
3. **Server:** creates a Stripe `PaymentIntent` using the SPT.
4. **Server:** returns the resource with a Receipt referencing the `PaymentIntent`.

## Intents

<Cards>
  <StripeChargeCard />
</Cards>

# Tempo \[Stablecoin payments on the Tempo blockchain]

The [Tempo](https://docs.tempo.xyz) payment method enables payments using TIP-20 stablecoins on the Tempo blockchain. Tempo supports multiple intents—**charge** for one-time payments and **session** for pay-as-you-go payment channels—covering everything from simple API access to high-frequency metered billing.

## Payments on Tempo

Tempo is purpose-built for the payment patterns MPP enables:

* **Instant finality**—Transactions settle in ~500ms with deterministic confirmation, no probabilistic waiting
* **Sub-cent fees**—Transaction costs low enough for micropayments and per-request billing
* **Fee sponsorship**—Servers can pay gas fees on behalf of clients, removing wallet UX friction entirely
* **2D nonces**—Parallel nonce lanes let clients submit payment transactions without blocking other account activity
* **Payment lane**—Dedicated transaction ordering for payment channel operations, providing reliable channel management UX
* **High throughput**—Tempo's throughput handles the on-chain settlement and channel management volume that payment sessions generate at scale

## Choosing a payment method

| | **Charge** | **Session** <Badge variant="info">Recommended</Badge> |
|---|---|---|
| **Pattern** | One-time payment per request | Continuous pay-as-you-go |
| **Latency overhead** | ~500ms (on-chain confirmation) | Near-zero |
| **Throughput** | One transaction per request | Hundreds of vouchers per second per channel |
| **Best for** | Single API calls, content access, one-off purchases | LLM APIs, metered services, usage-based billing |
| **On-chain cost** | Per request (0.001 USD per request) | Amortized across many requests (0.001 USD total) |
| **Settlement** | Immediate on-chain transaction | Off-chain vouchers, periodic on-chain settlement |

## Intents

<Cards>
  <TempoChargeCard />

  <TempoSessionCard />
</Cards>

## Fee sponsorship

Tempo supports server-paid transaction fees for both charge and session intents. When enabled, the client signs only the payment authorization and the server covers gas costs. The client doesn't need to hold gas tokens or understand fee mechanics.

Set `feePayer: true` in the Challenge request to enable this:

```ts twoslash
import { Mppx, tempo } from 'mppx/server'

const mppx = Mppx.create({ methods: [tempo()] })

declare const request: Request
// ---cut---
const response = await mppx.charge({
  amount: '0.1',
  currency: '0x20c0000000000000000000000000000000000000',
  feePayer: true, // [!code hl]
  recipient: '0xa726a1CD723409074DF9108A2187cfA19899aCF8',
})(request)
```

# Challenges \[Server-issued payment requirements]

Your server issues a **challenge** to describe the payment required for a resource. Send challenges in the `WWW-Authenticate` header using the `Payment` authentication scheme.

## Structure

```http
WWW-Authenticate: Payment id="qB3wErTyU7iOpAsD9fGhJk",
    realm="mpp.dev",
    method="tempo",
    intent="charge",
    expires="2025-01-15T12:05:00Z",
    request="eyJhbW91bnQiOiIxMDAwIiwiY3VycmVuY3kiOiJ1c2QifQ"
```

### Required parameters

| Parameter | Description |
|-----------|-------------|
| `id` | Unique challenge identifier, cryptographically bound to challenge parameters |
| `realm` | Protection space identifier (typically the API domain) |
| `method` | Payment method identifier (such as `tempo` or `stripe`) |
| `intent` | Payment intent type (such as `charge` or `authorize`) |
| `request` | Base64url-encoded JSON with payment details |

### Optional parameters

| Parameter | Description |
|-----------|-------------|
| `expires` | ISO 8601 timestamp when the challenge expires |
| `description` | Human-readable description of what's being paid for |

## `request` object

The `request` parameter contains method-specific payment details encoded as base64url JSON:

```json [Decoded request object]
{
  "amount": "1000",
  "currency": "usd",
  "recipient": "0xa726a1CD723409074DF9108A2187cfA19899aCF8"
}
```

Common fields across payment methods:

| Field | Description |
|-------|-------------|
| `amount` | Payment amount in base units (for example, cents for USD) |
| `currency` | Currency code (`usd`) or token address (`0x20c0...`) |
| `recipient` | Payment destination in method-native format |

## Multiple challenges

Servers can offer multiple payment options in a single response:

```http
HTTP/1.1 402 Payment Required
WWW-Authenticate: Payment id="abc", method="tempo", ...
WWW-Authenticate: Payment id="def", method="stripe", ...
```

Clients select one based on their capabilities and submit a single credential.

## Challenge binding

:::warning\[Security requirement]
Challenges must be cryptographically bound to their parameters through the `id` field. This prevents clients from reusing a challenge ID with modified payment terms.
:::

Typical binding includes:

* `realm`, `method`, `intent`
* Hash of the `request` object
* `expires` timestamp

Use an [HMAC-bound](https://en.wikipedia.org/wiki/HMAC) challenge ID to prevent clients from reusing a challenge ID with modified payment terms.

## Learn more

<Cards>
  <SpecCard to="https://tempoxyz.github.io/mpp-specs/" />

  <PaymentMethodsCard />
</Cards>

# Credentials \[Client-submitted payment proofs]

A **Credential** is your response to a [Challenge](/protocol/challenges), proving that you paid or authorized the payment. Send credentials in the `Authorization` header.

## Structure

```http
Authorization: Payment eyJjaGFsbGVuZ2UiOnsiaWQiOiJxQjN3RXJUeVU3aU9wQXNEOWZHaEprIiwi...
```

The credential is a base64url-encoded JSON object:

```json
{
  "challenge": {
    "id": "qB3wErTyU7iOpAsD9fGhJk",
    "realm": "mpp.dev",
    "method": "tempo",
    "intent": "charge",
    "request": "eyJhbW91bnQiOiIxMDAwIi4uLn0",
    "expires": "2025-01-15T12:05:00Z"
  },
  "source": "0x1234567890abcdef...",
  "payload": {
    "signature": "0xabc123..."
  }
}
```

### Fields

| Field | Description |
|-------|-------------|
| `challenge` | The [Challenge](/protocol/challenges) being responded to |
| `source` | Identity of the payer (address, DID, account ID) |
| `payload` | Method-specific payment proof |

## Single-use credentials

Each credential is valid for exactly one request. When processing a credential:

1. Verify the `challenge.id` matches an outstanding challenge
2. Verify the challenge has not expired
3. Verify the payment proof using method-specific procedures
4. Reject any replayed credentials

## Example

### Tempo charge payment

```json
{
  "challenge": {
    "id": "zL4xCvBnM6kJhGfD8sAaWe",
    "realm": "mpp.dev",
    "method": "tempo",
    "intent": "charge",
    "request": "eyJhbW91bnQiOiI1MDAwIiwiY3VycmVuY3kiOiJ1c2QiLCJyZWNpcGllbnQiOiIweDc0MmQzNUNjNjYzNEMwNTMyOTI1YTNiODQ0QmM5ZTc1OTVmOGZFMDAifQ"
  },
  "source": "0x1234567890abcdef1234567890abcdef12345678",
  "payload": {
    "signature": "0x1b2c3d4e5f6a7b8c9d0e..."
  }
}
```

The server verifies the signature authorizes a transfer matching the challenge parameters, then submits the payment on-chain.

## Learn more

<Cards>
  <SpecCard to="https://tempoxyz.github.io/mpp-specs/" />

  <PaymentMethodsCard />
</Cards>

# HTTP 402 payment required \[The status code that signals payment is required]

MPP gives the HTTP/1.1 `402 Payment Required` status code its semantics by pairing it with the HTTP `Payment` authentication scheme.

## Overview

Respond with `402` when:

* A resource requires payment as a precondition for access
* The server can provide a `Payment` challenge the client can fulfill
* Payment is the primary barrier (not authentication or authorization, which would result in a `401` and then potentially an incremental `402`)

```http
HTTP/1.1 402 Payment Required
WWW-Authenticate: Payment id="abc123",
    realm="mpp.dev",
    method="tempo",
    intent="charge",
    request="eyJ..."
```

## Status code comparison

| Condition | Status Code |
|-----------|-------------|
| Resource requires payment | **`402`** |
| Client lacks authentication | `401` |
| Client authenticated but unauthorized | `403` |
| Resource doesn't exist | `404` |

MPP uses `402` consistently for all payment-related challenges, including when a credential fails validation. This differs from other HTTP authentication schemes that use `401` for failed credentials.

## Token authentication

When a resource requires both **token** and **payment** authentication:

1. Verify authentication credentials
2. Return `401` if token authentication fails
3. Return `402` with a `Payment` challenge only after successful token authentication

This ordering prevents leaking payment requirements to unauthenticated clients.

:::info
Store authentication tokens in an [HTTP-only cookie](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html#httponly-attribute) to prevent them from conflicting with the payment `Authorization` header and to avoid exposing the token to the client.
:::

## Error responses

Failed payment attempts return `402` with a fresh challenge and a Problem Details body:

```http
HTTP/1.1 402 Payment Required
Cache-Control: no-store
Content-Type: application/problem+json
WWW-Authenticate: Payment id="new456", ...

{
  "type": "https://paymentauth.org/problems/verification-failed",
  "title": "Payment Verification Failed",
  "status": 402,
  "detail": "Invalid payment proof."
}
```

Error types include:

* `invalid-challenge`—Unknown, expired, or already-used challenge
* `malformed-credential`—Invalid base64url or bad JSON
* `method-unsupported`—Method not accepted (400)
* `payment-expired`—Challenge or authorization expired
* `payment-insufficient`—Amount too low
* `payment-required`—Resource requires payment
* `verification-failed`—Payment proof invalid

## Learn more

<Cards>
  <SpecCard to="https://tempoxyz.github.io/mpp-specs/" />
</Cards>

# Receipts \[Server acknowledgment of successful payment]

A **Receipt** is the server's acknowledgment of successful payment. Return receipts in the `Payment-Receipt` header on successful responses.

:::info
The `Payment-Receipt` header is optional. Servers should include it for auditability, but clients should not need it for correct operation.
:::

## Header

```http
HTTP/1.1 200 OK
Payment-Receipt: eyJzdGF0dXMiOiJzdWNjZXNzIiwibWV0aG9kIjoidGVtcG8iLCJ0aW1lc3RhbXAiOiIyMDI1LTAxLTE1VDEyOjAwOjAwWiJ9
Content-Type: application/json

{ "data": "Payment received." }
```

The receipt is a base64url-encoded JSON object.

## Structure

```json
{
  "challengeId": "qB3wErTyU7iOpAsD9fGhJk",
  "method": "tempo",
  "reference": "0xtx789abc...",
  "settlement": {
    "amount": "1000",
    "currency": "usd"
  },
  "status": "success",
  "timestamp": "2025-01-15T12:00:00Z"
}
```

### Fields

| Field | Description |
|-------|-------------|
| `challengeId` | The challenge this receipt responds to |
| `method` | Payment method used |
| `reference` | Method-specific payment reference (for example, transaction hash or invoice ID) |
| `settlement` | Actual amount and currency settled |
| `status` | Payment outcome (`success`) |
| `timestamp` | When the payment was processed |

## Use cases

Receipts enable:

* **Auditing**—Clients can log payment confirmations
* **Dispute resolution**—Reference IDs link to payment network records
* **Reconciliation**—Match payments to requests

## Payment method references

| Payment Method | Reference Format |
|----------------|------------------|
| Tempo | Transaction hash (`0xtx789...`) |
| Stripe | PaymentIntent ID (`pi_1234...`) |

## Learn more

<Cards>
  <SpecCard to="https://tempoxyz.github.io/mpp-specs/" />
</Cards>

# Transports \[HTTP and MCP bindings for payment flows]

MPP defines how the Payment authentication scheme operates over different transport protocols. The core protocol targets HTTP, with extensions for other transports like MCP.

## Available transports

| Transport | Use Case | Spec |
|-----------|----------|------|
| [HTTP](/protocol/transports/http) | REST APIs, web resources | [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110#section-11) |
| [MCP](/protocol/transports/mcp) | AI tool calls using Model Context Protocol | [MCP Transport Spec](https://tempoxyz.github.io/mpp-specs/) |

## Transport-agnostic design

MPP's core concepts—challenges, credentials, and receipts—remain the same across transports. The encoding and delivery mechanism changes:

* **HTTP** uses standard headers (`WWW-Authenticate`, `Authorization`, `Payment-Receipt`)
* **MCP** uses JSON-RPC error codes and `_meta` fields

Choose the transport that matches your protocol. HTTP for REST APIs, MCP for AI agent tool calls.

# Client quickstart \[Handle payment-gated resources automatically]

## Overview

Polyfill the global `fetch` to handle `402` responses. Your existing code works unchanged—payments happen in the background. Pick the path that suits you:

* [**Prompt mode**](#prompt-mode): paste a prompt into your coding agent for fast setup
* [**Manual mode**](#manual-mode): step-by-step setup with `mppx/client`

## Prompt mode

Paste this into your AI coding agent to set up your client with `mppx` in one shot:

<ClientPrompt />

## Manual mode

::::steps

### Install dependencies

:::code-group

```bash [npm]
npm install mppx viem
```

```bash [pnpm]
pnpm add mppx viem
```

```bash [bun]
bun add mppx viem
```

:::

### Define an account

```ts twoslash
import { privateKeyToAccount } from 'viem/accounts'

const account = privateKeyToAccount('0xabc…123')
```

:::tip
With Tempo, you can also use [Passkey or WebCrypto accounts](https://viem.sh/tempo/accounts).
:::

### Create payment handler

Call `Mppx.create` at startup. This polyfills the global `fetch` to automatically handle `402` payment challenges.

```ts twoslash
import { privateKeyToAccount } from 'viem/accounts'
import { Mppx, tempo } from 'mppx/client' // [!code hl]

const account = privateKeyToAccount('0xabc…123')

Mppx.create({ // [!code hl]
  methods: [tempo({ account })], // [!code hl] 
}) // [!code hl]
```

:::tip
If you want to avoid polyfilling, use the bound `fetch` instead.

```ts
const mppx = Mppx.create({
  polyfill: false, // [!code hl]
  methods: [tempo({ account })]
})

const response = await mppx.fetch('https://mpp.dev/api/ping/paid') // [!code hl]
```

:::

### Request protected resources

Use `fetch`. Payment happens when a server returns `402`.

```ts
const response = await fetch('https://mpp.dev/api/ping/paid')
```

::::

## Learn more

### Wagmi

You can inject a [Wagmi](https://wagmi.sh) connector into Mppx by passing the `getConnectorClient` function.

:::code-group

```ts twoslash [example.ts]
// @noErrors
import { Mppx, tempo } from 'mppx/client'
import { getConnectorClient } from 'wagmi/actions'
import { config } from './config'

Mppx.create({
  methods: [tempo({
    getClient: (parameters) => getConnectorClient(config, parameters), // 
  })],
})

const response = await fetch(`https://mpp.dev/api/ping/${address}`)
```

```ts twoslash [config.ts] filename="wagmi.config.ts"
// @noErrors
import { createConfig, http } from 'wagmi'
import { webAuthn } from 'wagmi/tempo'
import { tempoModerato } from 'viem/chains'

export const config = createConfig({
  connectors: [webAuthn()],
  chains: [tempoModerato],
  transports: {
    [tempoModerato.id]: http(),
  },
})
```

:::

### Per-request accounts

Pass accounts on individual requests instead of at setup:

```ts twoslash
import { privateKeyToAccount } from 'viem/accounts'
import { Mppx, tempo } from 'mppx/client'

const mppx = Mppx.create({
  polyfill: false,
  methods: [tempo()]
})

const response = await mppx.fetch('https://mpp.dev/api/ping/paid', {
  // [!code hl:start]
  context: {
    account: privateKeyToAccount('0xabc…123'),
  }
  // [!code hl:end]
})
```

### Manual payment handling

Use `Mppx.create` for full control over the payment flow:

* Present payment UI before paying
* Implement custom retry logic
* Handle credentials manually

```ts twoslash
import { Mppx, tempo } from 'mppx/client'
import { privateKeyToAccount } from 'viem/accounts'

const mppx = Mppx.create({
  // [!code hl:start]
  polyfill: false,
  // [!code hl:end]
  methods: [tempo()],
})

// [!code hl:start]
const response = await fetch('https://mpp.dev/api/ping/paid')

if (response.status === 402) {
  const credential = await mppx.createCredential(response, {
    account: privateKeyToAccount('0x...'),
  })

  const paidResponse = await fetch('https://mpp.dev/api/ping/paid', {
    headers: { Authorization: credential },
  })
}
// [!code hl:end]
```

### Payment receipts

On success, the server returns a `Payment-Receipt` header:

```ts
import { Receipt } from 'mppx'

const response = await fetch('https://mpp.dev/api/ping/paid')

const receipt = Receipt.fromResponse(response) // [!code hl]

console.log(receipt.status)     
// @log: success
console.log(receipt.reference)
// @log: 0xtx789abc...
console.log(receipt.timestamp)
// @log: 2025-01-15T12:00:00Z
```

## Next steps

<Cards>
  <ServerQuickstartCard />

  <TempoMethodCard />

  <MppxCreateReferenceCard to="/sdk/typescript/client/Mppx.create" />
</Cards>

# presto \[Make paid HTTP requests from the command line]

`presto` is a command-line HTTP client with automatic payment. On `402 Payment Required`, it handles payment and retries. No API keys needed.

## Quickstart

::::steps

### Install

```bash [install.sh]
$ curl -fsSL https://presto-binaries.tempo.xyz/install.sh | bash
```

### Log in

```bash [login.sh]
$ presto login
```

This opens your browser to authenticate with your Tempo wallet.

### Make your first paid request

```bash [paid-request.sh]
$ presto -v -X POST \
  --json '{"model":"openai/gpt-4o-mini","messages":[{"role":"user","content":"Hello!"}]}' \
  https://openrouter.mpp.tempo.xyz/v1/chat/completions
```

`presto` automatically detects the `402 Payment Required` response, signs a payment credential, and retries — all in one step.

::::

## Next steps

<Cards>
  <PrestoCliCard />

  <PrestoExamplesCard />
</Cards>

# Server quickstart \[Charge for resources and verify payment credentials]

## Overview

This quickstart demonstrates how to plug MPP into any server framework to accept payments for protected resources. Pick the path that suits you:

* [**Prompt mode**](#prompt-mode): paste a prompt into your AI coding agent and one shot
* [**Framework mode**](#framework-mode): use `mppx` middleware for Next.js, Hono, Elysia, or Express
* [**Manual mode**](#manual-mode): call `mppx/server` directly with the Fetch API

## Prompt mode

Paste this into your AI coding agent to set up a server with `mppx` in one shot:

<ServerPrompt />

## Framework mode

Use the framework-specific middleware from `mppx` to integrate payment into your server. Each middleware handles the `402` challenge/credential flow and attaches receipts automatically.

::::code-group

```ts [Next.js]
import { Mppx, tempo } from 'mppx/nextjs'

// [!code hl:start]
const mppx = Mppx.create({
  methods: [tempo({
    currency: '0x20c0000000000000000000000000000000000000',
    recipient: '0xa726a1CD723409074DF9108A2187cfA19899aCF8',
  })],
})
// [!code hl:end]

export const GET = 
  mppx.charge({ amount: '0.1' }) // [!code hl]
  (() => Response.json({ data: '...' }))
```

```ts [Hono]
import { Hono } from 'hono'
import { Mppx, tempo } from 'mppx/hono'

const app = new Hono()

// [!code hl:start]
const mppx = Mppx.create({
  methods: [tempo({
    currency: '0x20c0000000000000000000000000000000000000',
    recipient: '0xa726a1CD723409074DF9108A2187cfA19899aCF8',
  })],
})
// [!code hl:end]

app.get(
  '/resource', 
  mppx.charge({ amount: '0.1' }), // [!code hl]
  (c) => c.json({ data: '...' }),
)
```

```ts [Elysia]
import { Elysia } from 'elysia'
import { Mppx, tempo } from 'mppx/elysia'

// [!code hl:start]
const mppx = Mppx.create({
  methods: [tempo({
    currency: '0x20c0000000000000000000000000000000000000',
    recipient: '0xa726a1CD723409074DF9108A2187cfA19899aCF8',
  })],
})
// [!code hl:end]

const app = new Elysia()
  .guard(
    { beforeHandle: mppx.charge({ amount: '0.1' }) }, // [!code hl]
    (app) => app.get('/resource', () => ({ data: '...' })),
  )
```

```ts [Express]
import express from 'express'
import { Mppx, tempo } from 'mppx/express'

const app = express()

// [!code hl:start]
const mppx = Mppx.create({
  methods: [tempo({
    currency: '0x20c0000000000000000000000000000000000000',
    recipient: '0xa726a1CD723409074DF9108A2187cfA19899aCF8',
  })],
})
// [!code hl:end]

app.get(
  '/resource', 
  mppx.charge({ amount: '0.1' }), // [!code hl]
  (req, res) => res.json({ data: '...' }))
```

::::

:::tip
You can also override `currency` and `recipient` per call if different routes need different payment configurations.

```ts
mppx.charge({ 
  amount: '0.1', 
  currency: '0x…', // [!code ++]
  recipient: '0x…', // [!code ++]
})
```

:::

:::note
Don't see your framework? `mppx` is designed to be framework-agnostic. See [Manual mode](#manual-mode) below.
:::

## Manual mode

If you prefer full control over the payment flow, use `mppx/server` directly with the Fetch API.

```ts
import { Mppx, tempo } from 'mppx/server'

const mppx = Mppx.create({
  methods: [tempo({
    currency: '0x20c0000000000000000000000000000000000000',
    recipient: '0xa726a1CD723409074DF9108A2187cfA19899aCF8',
  })],
})

// [!code focus:start]
export async function handler(request: Request) { 
  const response = await mppx.charge({ amount: '0.1' })(request) 
  // [!code focus:end]

  // Payment required: send 402 response with challenge 
  if (response.status === 402) return response.challenge 

  // Payment verified: attach receipt and return resource 
  return response.withReceipt(Response.json({ data: '...' })) 
} 
```

:::info\[Currency and recipient values]
`currency` is the TIP-20 token contract address—[`0x20c0…`](https://explore.tempo.xyz/address/0x20c0000000000000000000000000000000000000?live=false) is pathUSD on Tempo. `recipient` is the address that receives payment. See [Tempo payment method](/payment-methods/tempo) for supported tokens.
:::

The intent handler accepts a [Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API)-compatible request object, and returns a `Response` object.

The Fetch API is compatible with most server frameworks, including: [Hono](https://hono.dev), [Deno](https://deno.com), [Cloudflare Workers](https://workers.dev), [Next.js](https://nextjs.org),
[Bun](https://bun.sh), and other Fetch API-compatible frameworks.

:::tip
You can also override `currency` and `recipient` per call if different routes need different payment configurations.

```ts
const response = await mppx.charge({ 
  amount: '0.1', 
  currency: '0x…', // [!code ++]
  recipient: '0x…', // [!code ++]
})(request) 
```

:::

## Node.js & Express compatibility

If your framework doesn't support the **Fetch API** (for example, Express or Node.js), you're likely interfacing with the [Node.js Request Listener API](https://nodejs.org/api/http.html#httpcreateserveroptions-requestlistener).

Use the `Mppx.toNodeListener` helper to transform the handler into a Node.js-compatible listener.

```ts twoslash
import { Mppx, tempo } from 'mppx/server'

const mppx = Mppx.create({
  methods: [tempo({
    currency: '0x20c0000000000000000000000000000000000000',
    recipient: '0xa726a1CD723409074DF9108A2187cfA19899aCF8',
  })],
})

type IncomingMessage = import('node:http').IncomingMessage
type ServerResponse = import('node:http').ServerResponse
// ---cut---
export async function handler(req: IncomingMessage, res: ServerResponse) { 
  const response = await Mppx.toNodeListener( // [!code ++]
    mppx.charge({ amount: '0.1' })
  )(req, res) // [!code ++]

  // Payment required: send 402 response with challenge 
  if (response.status === 402) return response.challenge 

  // Payment verified: attach receipt and return resource 
  return response.withReceipt(Response.json({ data: '...' })) 
} 
```

## Testing your server

After your server is running, test it with [presto](/tools/presto) or the `mppx` CLI:

::::code-group

```bash [presto]
# See the payment challenge
$ presto inspect <your-server>/resource

# Make a paid request (requires funded wallet)
$ presto query <your-server>/resource

# Verbose output to see the full 402 flow
$ presto query -vi <your-server>/resource

# Dry run to preview payment without executing
$ presto query -D <your-server>/resource
```

```bash [mppx]
# Create an account funded with testnet tokens
$ npx mppx account create

# Make a paid request
$ npx mppx <your-server>/resource
```

::::

:::tip
Use `presto inspect` or `npx mppx --inspect` to debug your server's Challenge response without making any payments.
:::

## Next steps

<Cards>
  <ClientQuickstartCard />

  <TempoMethodCard />

  <MppxCreateReferenceCard to="/sdk/typescript/server/Mppx.create" />
</Cards>

# Python SDK \[The pympp Python library]

## Overview

The `mpp` Python library provides a typed interface over the Machine Payments Protocol, from high-level abstractions to low-level primitives and building blocks.

<div className="flex gap-2">
  <SdkBadge.GitHub repo="tempoxyz/pympp" />

  <SdkBadge.Maintainer name="Tempo" href="https://github.com/tempoxyz" />
</div>

## Install

```bash [install.sh]
$ pip install pympp
```

With Tempo blockchain support:

```bash [install-with-tempo.sh]
$ pip install "pympp[tempo]"
```

## Requirements

* Python 3.10+
* `httpx` for async HTTP
* `eth-account` for Tempo signing (with `[tempo]` extra)

## Quick start

### Server

```python [server.py]
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from mpp import Challenge
from mpp.server import Mpp
from mpp.methods.tempo import tempo, ChargeIntent

app = FastAPI()

mpp = Mpp.create(
    method=tempo(
        currency="0x20c0000000000000000000000000000000000000",
        recipient="0xa726a1CD723409074DF9108A2187cfA19899aCF8",
        intents={"charge": ChargeIntent()},
    ),
)

@app.get("/resource")
async def get_resource(request: Request):
    result = await mpp.charge(
        authorization=request.headers.get("Authorization"),
        amount="0.50",
    )

    if isinstance(result, Challenge):
        return JSONResponse(
            status_code=402,
            content={"error": "Payment required"},
            headers={"WWW-Authenticate": result.to_www_authenticate(mpp.realm)},
        )

    credential, receipt = result
    return {"data": "paid content", "payer": credential.source}
```

### Client

```python [client.py]
import asyncio
from mpp.client import Client
from mpp.methods.tempo import tempo, TempoAccount, ChargeIntent

async def main():
    account = TempoAccount.from_env()

    async with Client(methods=[tempo(account=account, intents={"charge": ChargeIntent()})]) as client:
        response = await client.get("https://mpp.dev/api/ping/paid")
        print(response.json())

asyncio.run(main())
```

## Next steps

<Cards>
  <PythonCoreTypesCard />

  <PythonClientCard />

  <PythonServerCard />
</Cards>

# Rust SDK \[The mpp Rust library]

## Overview

The `mpp` Rust library provides a typed interface over the Machine Payments Protocol, from high-level abstractions to low-level primitives and building blocks.

<div className="flex gap-2">
  <SdkBadge.GitHub repo="tempoxyz/mpp-rs" />

  <SdkBadge.Maintainer name="Tempo" href="https://github.com/tempoxyz" />
</div>

## Install

```bash [install.sh]
$ cargo add mpp
```

With Tempo blockchain support:

```bash [install-with-tempo.sh]
$ cargo add mpp --features tempo,client,server
```

## Quick start

### Parse a Challenge

```rust
use mpp::parse_www_authenticate;

let header = r#"Payment id="abc", realm="mpp.dev", method="tempo", intent="charge", request="eyJhbW91bnQiOiIxMDAwIn0""#;
let challenge = parse_www_authenticate(header)?;

println!("Method: {}", challenge.method);
println!("Intent: {}", challenge.intent);
```

### Create a Credential

```rust
use mpp::{PaymentCredential, PaymentPayload, ChallengeEcho};

let credential = PaymentCredential::with_source(
    ChallengeEcho::new("challenge-id", "tempo", "charge"),
    PaymentCredential::evm_did(42431, "0xa726a1..."),
    PaymentPayload::transaction("0xf86c..."),
);

let header = mpp::format_authorization(&credential)?;
```

### Parse a Receipt

```rust
use mpp::parse_receipt;

let receipt = parse_receipt(receipt_header)?;
println!("Status: {:?}", receipt.status);
println!("Reference: {}", receipt.reference);
```

## Feature flags

| Feature | Description |
|---------|-------------|
| `client` | Client-side providers, HTTP extensions |
| `server` | Server verification, `ChargeMethod` trait |
| `tempo` | Tempo blockchain support |
| `middleware` | reqwest-middleware integration |

### Common feature flags

```toml
# Client only
mpp = { version = "0.1", features = ["tempo", "client"] }

# Server only
mpp = { version = "0.1", features = ["tempo", "server"] }

# Both
mpp = { version = "0.1", features = ["tempo", "client", "server"] }

# With middleware
mpp = { version = "0.1", features = ["tempo", "client", "middleware"] }
```

## Next steps

* [Client](/sdk/rust/client): Handle `402` responses automatically
* [Server](/sdk/rust/server): Protect endpoints with payments

# Getting started \[The mppx TypeScript library]

## Overview

The `mppx` TypeScript library provides a typed interface over the Machine Payments Protocol, from high-level abstractions to low-level primitives and building blocks.

<div className="flex gap-2">
  <SdkBadge.GitHub repo="wevm/mppx" />

  <SdkBadge.Maintainer name="Wevm" href="https://github.com/wevm" />
</div>

## Install

:::code-group

```bash [npm]
npm install mppx
```

```bash [pnpm]
pnpm add mppx
```

```bash [bun]
bun add mppx
```

:::

## Quick start

This quick start guide shows you how to use `mppx` with the [`tempo` payment method](/payment-methods/tempo).

You can apply the same patterns to [other payment methods](/payment-methods).

<Tabs stateKey="quickstart">
  <Tab title="Client">
    <div className="space-y-4">
      ::::steps

      #### Install peer dependencies

      In this example, you use the `viem` library to instantiate an account.

      :::code-group

      ```bash [npm]
      npm install viem
      ```

      ```bash [pnpm]
      pnpm add viem
      ```

      ```bash [bun]
      bun add viem
      ```

      :::

      #### Define an account

      Next, define an account to sign payments.

      ```ts twoslash [define-account.ts]
      import { privateKeyToAccount } from 'viem/accounts'

      const account = privateKeyToAccount('0xabc…123')
      ```

      :::tip
      When using Tempo, you can also use [Passkey or WebCrypto accounts](https://viem.sh/tempo/accounts).
      :::

      #### Create payment handler

      Call `Mppx.create` at startup. This polyfills the global `fetch` to automatically handle `402` payment challenges.

      ```ts twoslash [create-paid-fetch.ts]
      import { privateKeyToAccount } from 'viem/accounts'
      import { Mppx, tempo } from 'mppx/client' // [!code hl]

      const account = privateKeyToAccount('0xabc…123')

      Mppx.create({ // [!code hl]
        methods: [tempo({ account })], // [!code hl]
      }) // [!code hl]
      ```

      :::tip
      If you want to avoid polyfilling, use the returned `fetch` instead.

      ```ts
      const mppx = Mppx.create({
        polyfill: false, // [!code hl]
        methods: [tempo({ account })]
      })

      const response = await mppx.fetch('https://mpp.dev/api/ping/paid') // [!code hl]
      ```

      :::

      #### Request protected resources

      Use `fetch`. Payment happens when a server returns `402`.

      ```ts [fetch-resource.ts]
      const response = await fetch('https://mpp.dev/api/ping/paid')
      ```

      ::::
    </div>
  </Tab>

  <Tab title="Server">
    <div className="space-y-4">
      #### Framework mode

      Use the framework-specific middleware from `mppx` to integrate payment into your server. Each middleware handles the `402` challenge/credential flow and attaches receipts automatically.

      ::::code-group

      ```ts [Next.js]
      import { Mppx, tempo } from 'mppx/nextjs'

      // [!code hl:start]
      const mppx = Mppx.create({
        methods: [tempo({
          currency: '0x20c0000000000000000000000000000000000000',
          recipient: '0xa726a1CD723409074DF9108A2187cfA19899aCF8',
        })],
      })
      // [!code hl:end]

      export const GET = 
        mppx.charge({ amount: '0.1' }) // [!code hl]
        (() => Response.json({ data: '...' }))
      ```

      ```ts [Hono]
      import { Hono } from 'hono'
      import { Mppx, tempo } from 'mppx/hono'

      const app = new Hono()

      // [!code hl:start]
      const mppx = Mppx.create({
        methods: [tempo({
          currency: '0x20c0000000000000000000000000000000000000',
          recipient: '0xa726a1CD723409074DF9108A2187cfA19899aCF8',
        })],
      })
      // [!code hl:end]

      app.get(
        '/resource', 
        mppx.charge({ amount: '0.1' }), // [!code hl]
        (c) => c.json({ data: '...' }),
      )
      ```

      ```ts [Elysia]
      import { Elysia } from 'elysia'
      import { Mppx, tempo } from 'mppx/elysia'

      // [!code hl:start]
      const mppx = Mppx.create({
        methods: [tempo({
          currency: '0x20c0000000000000000000000000000000000000',
          recipient: '0xa726a1CD723409074DF9108A2187cfA19899aCF8',
        })],
      })
      // [!code hl:end]

      const app = new Elysia()
        .guard(
          { beforeHandle: mppx.charge({ amount: '0.1' }) }, // [!code hl]
          (app) => app.get('/resource', () => ({ data: '...' })),
        )
      ```

      ```ts [Express]
      import express from 'express'
      import { Mppx, tempo } from 'mppx/express'

      const app = express()

      // [!code hl:start]
      const mppx = Mppx.create({
        methods: [tempo({
          currency: '0x20c0000000000000000000000000000000000000',
          recipient: '0xa726a1CD723409074DF9108A2187cfA19899aCF8',
        })],
      })
      // [!code hl:end]

      app.get(
        '/resource', 
        mppx.charge({ amount: '0.1' }), // [!code hl]
        (req, res) => res.json({ data: '...' }))
      ```

      ::::

      :::tip
      You can also override `currency` and `recipient` per call if different routes need different payment configurations.

      ```ts
      mppx.charge({ 
        amount: '0.1', 
        currency: '0x…', // [!code ++]
        recipient: '0x…', // [!code ++]
      })
      ```

      :::

      :::note
      Don't see your framework? `mppx` is designed to be framework-agnostic. See [Manual mode](#manual-mode) below.
      :::

      <div className="h-2" />

      ***

      <div className="h-px" />

      #### Manual mode

      If you prefer full control over the payment flow, use `mppx/server` directly with the Fetch API.

      ```ts
      import { Mppx, tempo } from 'mppx/server'

      const mppx = Mppx.create({
        methods: [tempo({
          currency: '0x20c0000000000000000000000000000000000000',
          recipient: '0xa726a1CD723409074DF9108A2187cfA19899aCF8',
        })],
      })

      // [!code focus:start]
      export async function handler(request: Request) { 
        const response = await mppx.charge({ amount: '0.1' })(request) 
        // [!code focus:end]

        // Payment required: send 402 response with challenge 
        if (response.status === 402) return response.challenge 

        // Payment verified: attach receipt and return resource 
        return response.withReceipt(Response.json({ data: '...' })) 
      } 
      ```

      :::info\[Currency and recipient values]
      `currency` is the TIP-20 token contract address—`0x20c0…` is PathUSD on Tempo. `recipient` is the address that receives payment. See [Tempo payment method](/payment-methods/tempo) for supported tokens.
      :::

      The intent handler accepts a [Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API)-compatible request object, and returns a `Response` object.

      The Fetch API is compatible with most server frameworks, including: [Hono](https://hono.dev), [Deno](https://deno.com), [Cloudflare Workers](https://workers.dev), [Next.js](https://nextjs.org),
      [Bun](https://bun.sh), and other Fetch API-compatible frameworks.

      :::tip
      You can also override `currency` and `recipient` per call if different routes need different payment configurations.

      ```ts
      const response = await mppx.charge({ 
        amount: '0.1', 
        currency: '0x…', // [!code ++]
        recipient: '0x…', // [!code ++]
      })(request) 
      ```

      :::

      <div className="h-2" />

      ***

      <div className="h-px" />

      ## Node.js & Express compatibility

      If your framework doesn't support the **Fetch API** (for example, Express or Node.js), you're likely interfacing with the [Node.js Request Listener API](https://nodejs.org/api/http.html#httpcreateserveroptions-requestlistener).

      Use the `Mppx.toNodeListener` helper to transform the handler into a Node.js-compatible listener.

      ```ts twoslash
      import { Mppx, tempo } from 'mppx/server'

      const mppx = Mppx.create({
        methods: [tempo({
          currency: '0x20c0000000000000000000000000000000000000',
          recipient: '0xa726a1CD723409074DF9108A2187cfA19899aCF8',
        })],
      })

      type IncomingMessage = import('node:http').IncomingMessage
      type ServerResponse = import('node:http').ServerResponse
      // ---cut---
      export async function handler(req: IncomingMessage, res: ServerResponse) { 
        const response = await Mppx.toNodeListener( // [!code ++]
          mppx.charge({ amount: '0.1' })
        )(req, res) // [!code ++]

        // Payment required: send 402 response with challenge 
        if (response.status === 402) return response.challenge 

        // Payment verified: attach receipt and return resource 
        return response.withReceipt(Response.json({ data: '...' })) 
      } 
      ```
    </div>
  </Tab>

  <Tab title="CLI">
    <div className="space-y-4">
      The `mppx` package install automatically includes a [CLI tool](/sdk/typescript/cli) you can use to make the same request from the command line.

      ::::steps

      #### Create an account

      Create a Tempo account to sign payments. The account is auto-funded on testnet and key is stored in your system keychain.

      :::code-group

      ```bash [npm]
      $ npx mppx account create
      ```

      ```bash [pnpm]
      $ pnpm mppx account create
      ```

      ```bash [bun]
      $ bun mppx account create
      ```

      :::

      #### Make a paid request

      Run the CLI with a URL to make a paid request. Payment is handled automatically when the server returns `402`.

      :::code-group

      ```bash [npm]
      $ npx mppx https://mpp.dev/api/ping/paid
      ```

      ```bash [pnpm]
      $ pnpm mppx https://mpp.dev/api/ping/paid
      ```

      ```bash [bun]
      $ bun mppx https://mpp.dev/api/ping/paid
      ```

      :::

      ::::
    </div>
  </Tab>
</Tabs>

# presto \[Command-line HTTP client for MPP]

`presto` is a command-line HTTP client with automatic payment. On `402 Payment Required`, it handles payment and retries. No API keys needed.

## Install

```bash [install.sh]
$ curl -fsSL https://presto-binaries.tempo.xyz/install.sh | bash
```

## Setup

```bash [login.sh]
$ presto login
```

This opens your browser to authenticate with your Tempo wallet. Verify readiness:

```bash [preflight.sh]
$ presto whoami
```

Check `ready` is `true` and `key.balance` is sufficient. If not, run `presto login`.

:::tip\[Agent config]
Set `output_format = "json"` in config (`~/Library/Application Support/presto/config.toml` on macOS, `~/.config/presto/config.toml` on Linux) to avoid passing `--output-format json` on every call.
:::

## Available services

```bash [services.sh]
$ curl -s https://mpp.tempo.xyz/services | jq '.[].id'
```

Pattern: `<service>.mpp.tempo.xyz`. Examples:

* `https://openrouter.mpp.tempo.xyz/v1/chat/completions`
* `https://openai.mpp.tempo.xyz/v1/chat/completions`
* `https://anthropic.mpp.tempo.xyz/v1/messages`
* `https://fal.mpp.tempo.xyz/fal-ai/flux/schnell`

## Examples

```bash [examples.sh]
# LLM request
$ presto -X POST \
  --json '{"model":"openai/gpt-4o-mini","messages":[{"role":"user","content":"Hello"}]}' \
  https://openrouter.mpp.tempo.xyz/v1/chat/completions

# Image generation
$ presto -X POST \
  --json '{"prompt":"A sunset over mountains","image_size":"landscape_4_3","num_images":1}' \
  https://fal.mpp.tempo.xyz/fal-ai/flux/schnell

# Preview cost without paying
$ presto --dry-run -X POST \
  --json '{"model":"openai/gpt-4o-mini","messages":[{"role":"user","content":"Hello"}]}' \
  https://openrouter.mpp.tempo.xyz/v1/chat/completions
```

## Error recovery

| Exit code | Meaning | Action |
|-----------|---------|--------|
| 0 | Success | — |
| 1 | General error | Retry |
| 3 | Config error | `presto login` |
| 4 | Network error | Retry |
| 5 | Payment failed | Retry |
| 6 | Insufficient funds | Tell user to fund wallet |
| 8 | Auth error | `presto login` |
| 10 | Timeout | Retry with `-m <secs>` |

On `No wallet configured`, `Access key is not provisioned`, or exit 3/8: automatically run `presto login` then retry.
On `Spending limit exceeded` or `Insufficient balance`: report to user.

## Commands

| Command | Description |
|---------|-------------|
| `presto <url>` | HTTP request with automatic payment |
| `presto login` | Log in (opens browser) |
| `presto logout [--yes]` | Log out |
| `presto whoami` | Wallet status, balances, keys |
| `presto session close --all` | Reclaim funds from all payment sessions |

### Options

| Flag | Description |
|------|-------------|
| `-q` | Quiet (suppress logs, recommended for agents) |
| `--output-format json` | JSON output |
| `-X <METHOD>` | HTTP method |
| `--json <DATA>` | JSON body (sets Content-Type) |
| `-d <DATA>` | POST data (`@file` or `@-` for stdin) |
| `-H <HEADER>` | Custom header (repeatable) |
| `--dry-run` | Preview payment without executing |
| `-m <SECONDS>` | Timeout |
| `-i` | Include response headers |
| `-o <FILE>` | Write output to file |
| `-v` | Verbose (`-vv` debug, `-vvv` trace) |

## Learn more

<Cards>
  <PrestoExamplesCard />

  <PrestoDownloadCard />
</Cards>

# Stripe charge \[One-time payments using Stripe Payment Tokens]

The Stripe implementation of the [charge](/intents/charge) intent.

The client creates a [Stripe Payment Token (SPT)](https://docs.stripe.com/agentic-commerce/concepts/shared-payment-tokens) and sends it as a Credential. The server creates a Stripe `PaymentIntent` using the SPT, and settlement completes through Stripe's payment rails.

Use this method for single API calls, content access, or one-off purchases where you want to accept cards, wallets, or other Stripe-supported payment methods.

## Server

Use `stripe.charge` to require a one-time Stripe payment before returning a response. The method handles Challenge generation, Credential verification, PaymentIntent creation, and Receipt generation.

```ts twoslash
import { Mppx, stripe } from 'mppx/server'

const mppx = Mppx.create({
  methods: [
    stripe.charge({
      networkId: 'internal',
      paymentMethodTypes: ['card'],
      secretKey: process.env.STRIPE_SECRET_KEY!,
    }),
  ],
})

export async function handler(request: Request) {
  const result = await mppx.charge({
    amount: '1',
    currency: 'usd',
    decimals: 2,
    description: 'Premium API access',
  })(request)

  if (result.status === 402) return result.challenge

  return result.withReceipt(Response.json({ data: '...' }))
}
```

### With metadata

Include `metadata` in the `stripe.charge` configuration to forward key-value pairs to Stripe. The metadata appears in the Challenge and attaches to the Stripe `PaymentIntent`.

```ts twoslash
import { Mppx, stripe } from 'mppx/server'

const mppx = Mppx.create({
  methods: [
    stripe.charge({
      metadata: { plan: 'pro' }, // [!code hl]
      networkId: 'internal',
      paymentMethodTypes: ['card'],
      secretKey: process.env.STRIPE_SECRET_KEY!,
    }),
  ],
})

export async function handler(request: Request) {
  const result = await mppx.charge({
    amount: '1',
    currency: 'usd',
    decimals: 2,
  })(request)

  if (result.status === 402) return result.challenge

  return result.withReceipt(Response.json({ data: '...' }))
}
```

### With multiple payment method types

Allow multiple payment methods, like cards and Link, by specifying them in `paymentMethodTypes`.

```ts twoslash
import { Mppx, stripe } from 'mppx/server'

const mppx = Mppx.create({
  methods: [
    stripe.charge({
      networkId: 'internal',
      paymentMethodTypes: ['card', 'link'], // [!code hl]
      secretKey: process.env.STRIPE_SECRET_KEY!,
    }),
  ],
})
```

### Server parameters

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `metadata` | `Record<string, string>` | Optional | Key-value pairs forwarded to Stripe |
| `networkId` | `string` | Required | Stripe [Business Network](https://docs.stripe.com/get-started/account/profile) profile ID |
| `paymentMethodTypes` | `string[]` | Required | Allowed Stripe payment method types |
| `secretKey` | `string` | Required | Stripe secret API key |

## Client

Use `stripe` with `Mppx.create` to automatically handle `402` responses. The client parses the Challenge, creates an SPT through the `createToken` callback, and retries with the Credential.

SPT creation requires a Stripe secret key, so the client accepts a `createToken` callback that proxies through a server endpoint.

```ts twoslash
import { Mppx, stripe } from 'mppx/client'

Mppx.create({
  methods: [
    stripe({
      createToken: async (params) => {
        const res = await fetch('/api/create-spt', {
          body: JSON.stringify(params),
          headers: { 'Content-Type': 'application/json' },
          method: 'POST',
        })
        if (!res.ok) throw new Error('Failed to create SPT')
        return (await res.json()).spt
      },
    }),
  ],
})

const response = await fetch('https://api.example.com/resource')
// @log: Response { status: 200, ... }
```

### With Stripe Elements

Collect the payment method from the user using Stripe Elements, then pass it at credential-creation time through `context`.

```ts twoslash
import { Challenge } from 'mppx'
import { stripe } from 'mppx/client'

declare const stripeClient: {
  createPaymentMethod(opts: any): Promise<{ paymentMethod: { id: string } | null; error: any }>
}
declare const elements: any
// ---cut---
const charge = stripe.charge({
  createToken: async (params) => {
    const res = await fetch('/api/create-spt', {
      body: JSON.stringify(params),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    })
    return (await res.json()).spt
  },
})

// 1. Get the 402 challenge
const response = await fetch('/api/resource')
const challenge = Challenge.fromResponse(response, { methods: [charge] })

// 2. Collect payment method from Stripe Elements
const { paymentMethod } = await stripeClient.createPaymentMethod({ elements })

// 3. Create credential with the collected payment method
const credential = await charge.createCredential({
  challenge,
  context: { paymentMethod: paymentMethod!.id },
})

// 4. Retry with credential
const paid = await fetch('/api/resource', {
  headers: { Authorization: credential },
})
```

### Without polyfill

If you don't want to patch `globalThis.fetch`, use `mppx.fetch` directly:

```ts twoslash
import { Mppx, stripe } from 'mppx/client'

const mppx = Mppx.create({
  polyfill: false,
  methods: [
    stripe({
      createToken: async (params) => {
        const res = await fetch('/api/create-spt', {
          body: JSON.stringify(params),
          headers: { 'Content-Type': 'application/json' },
          method: 'POST',
        })
        return (await res.json()).spt
      },
    }),
  ],
})

const response = await mppx.fetch('https://api.example.com/resource')
```

### Client parameters

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `createToken` | `(params) => Promise<string>` | Required | Callback to create an SPT (proxied through a server endpoint) |
| `externalId` | `string` | Optional | Client reference ID included in the Credential payload |
| `paymentMethod` | `string` | Optional | Default Stripe payment method ID (overridden by `context.paymentMethod`) |

### `createToken` callback parameters

The `createToken` callback receives a single object with the following fields:

| Field | Type | Description |
| --- | --- | --- |
| `amount` | `string` | Payment amount in smallest currency unit |
| `challenge` | `Challenge` | The parsed Challenge from the server |
| `currency` | `string` | Three-letter ISO currency code |
| `expiresAt` | `number` | SPT expiration as a Unix timestamp (seconds) |
| `metadata` | `Record<string, string>` | Optional metadata from the Challenge |
| `networkId` | `string \| undefined` | Stripe Business Network profile ID |
| `paymentMethod` | `string \| undefined` | Stripe payment method ID |

## Request fields

The Challenge request includes the base charge fields plus Stripe method details.

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `amount` | `string` | Required | Amount in the smallest currency unit |
| `currency` | `string` | Required | ISO currency code |
| `decimals` | `number` | Required | Number of decimal places in the amount (for example, `2` for cents) |
| `description` | `string` | Optional | Human-readable payment description |
| `expires` | `string` | Optional | ISO 8601 expiration timestamp (defaults to 5 minutes) |
| `externalId` | `string` | Optional | Merchant reference ID |
| `methodDetails.metadata` | `Record<string, string>` | Optional | Metadata forwarded to Stripe |
| `methodDetails.networkId` | `string` | Required | Stripe Business Network profile ID |
| `methodDetails.paymentMethodTypes` | `string[]` | Required | Allowed Stripe payment method types |

## Credential payload

The Credential payload contains the SPT and an optional client reference ID.

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `externalId` | `string` | Optional | Client reference ID |
| `spt` | `string` | Required | Stripe Payment Token ID (starts with `spt_`) |

## Specification

<Cards>
  <SpecCard to="https://tempoxyz.github.io/mpp-specs/draft-stripe-charge-00" />
</Cards>

# Tempo charge \[One-time TIP-20 token transfers]

The Tempo implementation of the [charge](/intents/charge) intent.

The client signs a TIP-20 `transfer` transaction, the server broadcasts it to Tempo, and settlement completes in ~500ms with deterministic finality.

This method is best for single API calls, content access, or one-off purchases.

## Server

Use [`mppx.charge`](/sdk/typescript/server/Method.tempo.charge) to gate any endpoint behind a one-time payment. The method handles Challenge generation, Credential verification, transaction broadcast, and Receipt creation.

```ts twoslash
import { Mppx, tempo } from 'mppx/server'

const mppx = Mppx.create({
  methods: [tempo()],
})

export async function handler(request: Request) {
  const result = await mppx.charge({
    amount: '0.1',
    currency: '0x20c0000000000000000000000000000000000000',
    recipient: '0xa726a1CD723409074DF9108A2187cfA19899aCF8',
  })(request)

  if (result.status === 402) return result.challenge

  return result.withReceipt(Response.json({ data: '...' }))
}
```

### With expiry

```ts twoslash
import { Mppx, tempo } from 'mppx/server'

const mppx = Mppx.create({ methods: [tempo()] })
// ---cut---
import { Expires } from 'mppx'

export async function handler(request: Request) {
  const result = await mppx.charge({
    amount: '0.1',
    currency: '0x20c0000000000000000000000000000000000000',
    expires: Expires.minutes(10), // [!code hl]
    recipient: '0xa726a1CD723409074DF9108A2187cfA19899aCF8',
  })(request)

  if (result.status === 402) return result.challenge
  return result.withReceipt(Response.json({ data: '...' }))
}
```

### With fee sponsorship

```ts twoslash
import { Mppx, tempo } from 'mppx/server'

const mppx = Mppx.create({ methods: [tempo()] })

declare const request: Request
// ---cut---
const result = await mppx.charge({
  amount: '0.1',
  currency: '0x20c0000000000000000000000000000000000000',
  feePayer: true, // [!code hl]
  recipient: '0xa726a1CD723409074DF9108A2187cfA19899aCF8',
})(request)
```

When `feePayer` is `true`, the server adds a fee payer signature (domain `0x78`) before broadcasting. The client doesn't need gas tokens. See [fee sponsorship](/payment-methods/tempo#fee-sponsorship) for details.

:::info
See [`tempo.charge` server reference](/sdk/typescript/server/Method.tempo.charge) for the full parameter list.
:::

## Client

Use [`tempo.charge`](/sdk/typescript/client/Method.tempo.charge) with `Mppx.create` to automatically handle `402` responses. The client parses the Challenge, signs a TIP-20 transfer, and retries with the Credential.

```ts twoslash
import { Mppx, tempo } from 'mppx/client'
import { privateKeyToAccount } from 'viem/accounts'

const account = privateKeyToAccount('0xabc…123')

Mppx.create({
  methods: [tempo.charge({ account })],
})

const response = await fetch('https://api.example.com/resource')
```

### Without polyfill

If you don't want to patch `globalThis.fetch`, use `mppx.fetch` directly:

```ts twoslash
import { Mppx, tempo } from 'mppx/client'
import { privateKeyToAccount } from 'viem/accounts'

const account = privateKeyToAccount('0xabc…123')

const mppx = Mppx.create({
  polyfill: false,
  methods: [tempo.charge({ account })],
})

const response = await mppx.fetch('https://api.example.com/resource')
```

:::info
See [`tempo.charge` client reference](/sdk/typescript/client/Method.tempo.charge) for the full parameter list.
:::

## Specification

<Cards>
  <SpecCard to="https://tempoxyz.github.io/mpp-specs/draft-tempo-charge-00" />
</Cards>

# Session \[Low-cost high-throughput payments]

The `session` intent enables high-frequency, pay-as-you-go payments over unidirectional payment channels. Clients deposit funds into an on-chain escrow and sign off-chain vouchers as they consume resources. The server verifies vouchers with fast signature checks—no RPC or blockchain calls -- and settles periodically in batches.

Payment sessions reduce payment verification to near constant time, making it possible to meter and bill at the granularity of individual LLM tokens, API calls, or bytes transferred.

## Why sessions matter in MPP

Traditional payment rails target human purchase flows: a buyer decides, pays, and receives goods. Usage-based billing—the model that powers cloud infrastructure, LLM APIs, and metered services—requires something fundamentally different. It needs payment verification that can keep pace with the service itself.

Consider an LLM API: a single inference request can generate hundreds of tokens over several seconds. Each token has a known cost, but the total cost isn't known when the request begins. Standard billing models handle this by accumulating usage and charging after the fact, introducing credit risk, reconciliation complexity, and billing disputes. Prepaid credit systems require the client to guess consumption upfront and lose unused funds.

Sessions on Tempo solve this by making payment a continuous, inline part of the HTTP request. The client signs a cumulative voucher for each increment of service consumed, and the server verifies it in microseconds. The server delays on-chain settlement to whenever it chooses, batching hundreds or thousands of vouchers into a single on-chain transaction. This reduces both the latency and the cost of payment verification to near zero.

## How it works

### Overview

<MermaidDiagram
  chart={`sequenceDiagram
  participant Client
  participant Server
  participant Tempo
  Client->>Tempo: (1) Deposit tokens
  Tempo-->>Client: Channel created
  Client->>Server: (2) Open credential
  Note over Server: Verify on-chain deposit
  Server-->>Client: 200 OK (session established)
  loop Per request
      Client->>Server: (3) Request + voucher
      Note over Server: recover signature (ecrecover) 
      Server-->>Client: 200 OK + Receipt
  end
  Note over Server: (4) Periodic settlement
  Server->>Tempo: settle(channelId, voucher)
  Client->>Server: (5) Close
  Server->>Tempo: close(channelId, voucher)
  Tempo-->>Client: Refund remaining deposit
`}
/>

A payment session has four phases:

::::steps

### Open

The client deposits funds into an on-chain escrow contract, creating a payment channel between the client (payer) and server (payee). A unique `channelId` identifies the channel and holds the deposited TIP-20 tokens.

### Session

The client signs EIP-712 vouchers with increasing cumulative amounts as service is consumed. Each voucher authorizes "I have now consumed up to X total." The server verifies the signature, checks that the cumulative amount is higher than the previous voucher, and grants access based on the delta.

Voucher verification is CPU-bound: a single `ecrecover` call against the EIP-712 typed data. No RPC calls. No database lookups in the critical path. This is what enables per-token LLM billing without adding network latency.

### Top up

If the channel runs low on funds, the client deposits additional tokens without closing the channel. The session continues uninterrupted.

### Close

Either party can close the channel. The server calls `close()` on the escrow contract with the highest voucher, settling the final balance on-chain and refunding any unused deposit to the client.

::::

## High volume API billing

Payment sessions match the billing model that high-volume APIs need: pay stablecoin tokens, receive API responses. The granularity of payment matches the granularity of consumption.

A typical flow for a high-volume large language model API:

1. **Client:** opens a channel with a 10 USDC deposit
2. **Client:** sends a prompt to the API
3. **Server:** issues Challenges requesting payment for each chunk (for example, 0.000025 USDC per token)
4. **Client:** signs a voucher for each chunk—the cumulative amount increases by the cost of tokens received
5. **Server:** verifies the voucher signature (~microseconds) and sends the next chunk
6. **Server:** settles on-chain and the client gets the unused deposit back

The server never touches the chain during inference. Payment verification adds microseconds of CPU overhead per chunk, not hundreds of milliseconds of network latency.

:::info\[Why Tempo]
Tempo handles payments at scale and has properties that make it a uniquely good fit for payment sessions:

* **Channel management UX**—Opening, topping up, and closing channels are on-chain operations. Tempo's ~500ms finality and sub-cent fees keep channel lifecycle from becoming a UX bottleneck.
* **Payment lane**—Tempo's 2D nonce system provides dedicated nonce lanes for payment transactions, so channel operations don't block other account activity. This matters for clients that use the same account for payments and other on-chain interactions.
* **High throughput**—When a server settles thousands of channels, Tempo's throughput handles the settlement volume without congestion or fee spikes.
* **Fee sponsorship**—Servers can pay channel management fees on behalf of clients, making the client-side integration purely off-chain after the initial deposit.
* **Enshrined tokens**—TIP-20 tokens are precompile-based, not smart contracts. Token operations are cheaper and more predictable than ERC-20 interactions on other chains.
  :::

## Integration

<Tabs stateKey="platform">
  <Tab title="Server">
    <div className="space-y-4">
      Use [`tempo`](/sdk/typescript/server/Method.tempo.session) to accept payment sessions. The server needs an RPC URL for on-chain verification during channel open/close, and a storage backend for channel state.

      ```ts twoslash
      import { Mppx, Store, tempo } from 'mppx/server'

      const mppx = Mppx.create({
        methods: [
          tempo({
            recipient: '0xa726a1CD723409074DF9108A2187cfA19899aCF8',
            store: Store.memory(),
          }),
        ],
      })
      ```

      During a session, the server verifies each voucher with a single `ecrecover`—no RPC calls, no database writes in the hot path. On-chain interaction only happens during open, settlement, and close.

      Use `mppx.session` in your request handler to meter access:

      ```ts twoslash
      import { Mppx, tempo } from 'mppx/server'

      const mppx = Mppx.create({
        methods: [
          tempo.session({
            currency: '0x20c0000000000000000000000000000000000000',
            recipient: '0xa726a1CD723409074DF9108A2187cfA19899aCF8',
          }),
        ],
      })
      // ---cut---
      export async function handler(request: Request) {
        const result = await mppx.session({
          amount: '25',
          unitType: 'llm_token',
        })(request)

        if (result.status === 402) return result.challenge

        return result.withReceipt(Response.json({ data: '...' }))
      }
      ```
    </div>
  </Tab>

  <Tab title="Client">
    <div className="space-y-4">
      Use [`tempo`](/sdk/typescript/client/Method.tempo) with `Mppx.create` to sign vouchers automatically when the server requests payment sessions.

      ```ts twoslash
      import { Mppx, tempo } from 'mppx/client'
      import { privateKeyToAccount } from 'viem/accounts'

      const account = privateKeyToAccount('0xabc…123')

      Mppx.create({
        methods: [tempo({ account })],
      })

      const response = await fetch('https://api.example.com/v1/chat/completions')
      // Automatically opens channel, signs vouchers per chunk
      ```

      ### Without polyfill

      If you don't want to patch `globalThis.fetch`, use `mppx.fetch` directly:

      ```ts twoslash
      import { Mppx, tempo } from 'mppx/client'
      import { privateKeyToAccount } from 'viem/accounts'

      const account = privateKeyToAccount('0xabc…123')

      const mppx = Mppx.create({
        polyfill: false,
        methods: [tempo.session({ account })],
      })

      const response = await mppx.fetch('https://api.example.com/v1/chat/completions')
      ```

      ### With multiple methods

      Register multiple methods so the client can handle servers that offer multiple payment methods.

      For example, to accept both charge and payment sessions:

      ```ts twoslash
      import { Mppx, tempo } from 'mppx/client'
      import { privateKeyToAccount } from 'viem/accounts'

      const account = privateKeyToAccount('0xabc…123')

      Mppx.create({
        methods: [
          tempo.charge({ account }),
          tempo.session({ account }),
        ],
      })
      ```

      :::info
      See [`tempo.session` client reference](/sdk/typescript/client/Method.tempo.session) for the full parameter list.
      :::
    </div>
  </Tab>
</Tabs>

## Specification

<Cards>
  <SpecCard to="https://tempoxyz.github.io/mpp-specs/draft-tempo-session-00" />
</Cards>

# HTTP transport \[Payment flows using standard HTTP headers]

The HTTP transport is the primary binding for MPP, using standard HTTP headers from [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110#section-11).

## Headers

| Direction | Header | Purpose |
|-----------|--------|---------|
| Server → Client | `WWW-Authenticate: Payment ...` | Challenge |
| Client → Server | `Authorization: Payment ...` | Credential |
| Server → Client | `Payment-Receipt: ...` | Receipt |

## Example flow

:::steps

### <div className="mr-2"><Badge variant="info">Client</Badge></div> Request a resource

```http
GET /api/data HTTP/1.1
Host: api.example.com
```

### <div className="mr-2"><Badge variant="warning">Server</Badge></div> Send a payment challenge

Return the `WWW-Authenticate` header with a `Payment` challenge.

```http
HTTP/1.1 402 Payment Required
WWW-Authenticate: Payment id="abc123", method="tempo", intent="charge", request="..."
```

### <div className="mr-2"><Badge variant="info">Client</Badge></div> Retry with a credential

Send the `Authorization` header.

```http
GET /api/data HTTP/1.1
Host: api.example.com
Authorization: Payment eyJjaGFsbGVuZ2UiOnsiaWQiOiJhYmMxMjMi...
```

### <div className="mr-2"><Badge variant="warning">Server</Badge></div> Return a receipt

Return the `Payment-Receipt` header with a success receipt.

```http
HTTP/1.1 200 OK
Payment-Receipt: eyJzdGF0dXMiOiJzdWNjZXNzIi4uLn0
Content-Type: application/json

{"data": "..."}
```

:::

## Header encoding

Challenges are encoded as [auth-params](https://www.rfc-editor.org/rfc/rfc9110#section-11.2) in `WWW-Authenticate`. Credentials and receipts use base64url-encoded JSON.

## Full specification

<Cards>
  <SpecCard to="https://tempoxyz.github.io/mpp-specs/" />
</Cards>

# MCP transport \[Payment flows for AI tool calls]

The [Model Context Protocol](https://modelcontextprotocol.io) (MCP) transport enables payments for AI tool calls using JSON-RPC.

## Overview

AI agents use MCP to call tools on remote servers. The MCP transport allows these tool calls to require payment, enabling autonomous agent-to-service payments.

| MPP Concept | MCP Encoding |
|-------------|--------------|
| Challenge | JSON-RPC error code `-32042` |
| Credential | `_meta.org.paymentauth/credential` |
| Receipt | `_meta.org.paymentauth/receipt` |

## Challenge

Payment requirements are signaled using JSON-RPC error code `-32042`:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32042, // [!code highlight]
    "message": "Payment Required",
    "data": {
      "httpStatus": 402,
      "challenges": [{ // [!code highlight]
        "id": "ch_abc123",
        "realm": "search.example.com",
        "method": "tempo",
        "intent": "charge",
        "request": {
          "amount": "10",
          "currency": "usd",
          "recipient": "0xa726a1..."
        }
      }]
    }
  }
}
```

## Credential

Credentials are passed in the `_meta` field of the tool call:

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "web-search",
    "arguments": {"query": "MCP protocol"},
    "_meta": { // [!code highlight]
      "org.paymentauth/credential": { // [!code highlight]
        "challenge": { ... },
        "source": "0x1234...",
        "payload": { "signature": "0xabc..." }
      }
    }
  }
}
```

## Receipt

Receipts are returned in the result `_meta`:

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "content": [{ "type": "text", "text": "Search results..." }],
    "_meta": { // [!code highlight]
      "org.paymentauth/receipt": { // [!code highlight]
        "status": "success",
        "challengeId": "ch_abc123",
        "method": "tempo"
      }
    }
  }
}
```

## Comparison with HTTP

| Aspect | HTTP | MCP |
|--------|------|-----|
| Challenge delivery | `WWW-Authenticate` header | JSON-RPC error `-32042` |
| Credential delivery | `Authorization` header | `_meta.org.paymentauth/credential` |
| Receipt delivery | `Payment-Receipt` header | `_meta.org.paymentauth/receipt` |
| Encoding | Base64url in headers | Native JSON in body |

## Example flow

:::steps

### <div className="mr-2"><Badge variant="info">Agent</Badge></div> Call a tool

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "web-search",
    "arguments": {"query": "MCP payments"}
  }
}
```

### <div className="mr-2"><Badge variant="warning">Server</Badge></div> Return payment challenge

Respond with error code `-32042`:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32042,
    "message": "Payment Required",
    "data": {
      "challenges": [{ "id": "ch_abc", "method": "tempo", ... }]
    }
  }
}
```

### <div className="mr-2"><Badge variant="info">Agent</Badge></div> Retry with credential

Include the credential in `_meta`:

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "web-search",
    "arguments": {"query": "MCP payments"},
    "_meta": {
      "org.paymentauth/credential": { ... }
    }
  }
}
```

### <div className="mr-2"><Badge variant="warning">Server</Badge></div> Return result with receipt

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "content": [{ "type": "text", "text": "Results..." }],
    "_meta": {
      "org.paymentauth/receipt": { "status": "success", ... }
    }
  }
}
```

:::

## Full specification

<Cards>
  <SpecCard to="https://tempoxyz.github.io/mpp-specs/" />
</Cards>

# Client \[Handle 402 responses automatically]

Handle `402` Payment Required responses automatically.

## Quick start

```python [client.py]
from mpp.client import Client
from mpp.methods.tempo import tempo, TempoAccount, ChargeIntent

account = TempoAccount.from_key("0x...")

async with Client(methods=[tempo(account=account, intents={"charge": ChargeIntent()})]) as client:
    response = await client.get("https://api.example.com/resource")
    print(response.json())
```

## Common methods

| Method | Description |
|--------|-------------|
| `delete(url, **kwargs)` | DELETE request with payment handling |
| `get(url, **kwargs)` | GET request with payment handling |
| `post(url, **kwargs)` | POST request with payment handling |
| `put(url, **kwargs)` | PUT request with payment handling |
| `request(method, url, **kwargs)` | Generic request |

## One-off requests

```python [client.py]
from mpp.client import get
from mpp.methods.tempo import tempo, TempoAccount, ChargeIntent

response = await get(
    "https://api.example.com/resource",
    methods=[tempo(account=TempoAccount.from_key("0x..."), intents={"charge": ChargeIntent()})],
)
```

## Payment sessions

For payment session channels, use `StreamMethod` instead of `tempo()`. The client opens a payment channel and sends incremental vouchers as it consumes content:

```python [stream.py]
import httpx
from mpp.client import PaymentTransport
from mpp.methods.tempo import StreamMethod, TempoAccount

account = TempoAccount.from_key("0x...")

method = StreamMethod(
    account=account,
    currency="0x20c0000000000000000000000000000000000000",
    deposit=10_000_000,
)

transport = PaymentTransport(methods=[method])
async with httpx.AsyncClient(transport=transport, timeout=60.0) as client:
    async with client.stream("GET", "https://api.example.com/chat",
        params={"prompt": "Explain payment channels"},
    ) as response:
        async for line in response.aiter_lines():
            if line.startswith("data: "):
                print(line[6:], end="", flush=True)
```

`StreamMethod` auto-manages the channel lifecycle—opening the channel on the first request and sending cumulative vouchers on subsequent requests to the same server.

## Custom httpx transport

`PaymentTransport` wraps any `httpx.AsyncBaseTransport`, so you can compose it with custom transports:

```python [transport.py]
import httpx
from mpp.client import PaymentTransport
from mpp.methods.tempo import tempo, TempoAccount, ChargeIntent

account = TempoAccount.from_key("0x...")
transport = PaymentTransport(
    methods=[tempo(account=account, intents={"charge": ChargeIntent()})],
    inner=httpx.AsyncHTTPTransport(retries=3),
)

async with httpx.AsyncClient(transport=transport) as client:
    response = await client.get("https://api.example.com/resource")
```

For manual Challenge/Credential handling, see [Core types](/sdk/python/core).

# Core Types \[Challenge, Credential, and Receipt primitives]

The SDK provides three core types that map directly to HTTP headers: `Challenge`, `Credential`, and `Receipt`.

```python
from mpp import Challenge, Credential, Receipt
```

## Parse a Challenge

```python
challenge = Challenge.from_www_authenticate(
    'Payment id="...", realm="...", method="tempo", intent="charge", request="eyJ..."'
)
```

## Create and serialize a Credential

```python
credential = Credential(
    id="challenge-id",
    payload={"type": "transaction", "signature": "0x..."},
    source="did:pkh:eip155:42431:0xa726a1...",
)

header = credential.to_authorization()
```

## Parse and serialize a Receipt

```python
receipt = Receipt.from_payment_receipt(header_value)
header = receipt.to_payment_receipt()
```

# Server \[Protect endpoints with payment requirements]

Protect endpoints with payment requirements.

## Quick start

Create an `Mpp` instance with `Mpp.create()` and call `charge()` with a human-readable amount. The `tempo()` factory creates a Tempo payment method—configure `currency` and `recipient` once, then every `charge()` call uses those defaults.

```python [server.py]
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from mpp import Challenge
from mpp.server import Mpp
from mpp.methods.tempo import tempo, ChargeIntent

app = FastAPI()

mpp = Mpp.create(
    method=tempo(
        currency="0x20c0000000000000000000000000000000000000",
        recipient="0xa726a1CD723409074DF9108A2187cfA19899aCF8",
        intents={"charge": ChargeIntent()},
    ),
)

@app.get("/resource")
async def get_resource(request: Request):
    result = await mpp.charge(
        authorization=request.headers.get("Authorization"),
        amount="0.50",
    )

    if isinstance(result, Challenge):
        return JSONResponse(
            status_code=402,
            content={"error": "Payment required"},
            headers={"WWW-Authenticate": result.to_www_authenticate(mpp.realm)},
        )

    credential, receipt = result
    return {"data": "paid content", "payer": credential.source}
```

`Mpp.create()` auto-detects `realm` from environment variables (`VERCEL_URL`, `FLY_APP_NAME`, `HOSTNAME`, and others) and auto-generates a `secret_key` persisted to `.env`. Pass explicit values to override:

```python [server.py]
mpp = Mpp.create(
    method=tempo(
        currency="0x20c0000000000000000000000000000000000000",
        recipient="0xa726a1CD723409074DF9108A2187cfA19899aCF8",
        intents={"charge": ChargeIntent()},
    ),
    realm="api.example.com",
    secret_key="my-server-secret",
)
```

## `tempo()` factory

`tempo()` creates a `TempoMethod` that bundles a payment network, its intents, and default parameters together. Each intent must be explicitly registered via the `intents` parameter.

```python [server.py]
from mpp.methods.tempo import tempo, ChargeIntent

method = tempo(
    currency="0x20c0000000000000000000000000000000000000",
    recipient="0xa726a1CD723409074DF9108A2187cfA19899aCF8",
    intents={"charge": ChargeIntent()},
)
```

### With charge and session

Register both intents on a single method:

```python [server.py]
from mpp.methods.tempo import tempo, ChargeIntent, StreamIntent
from mpp.methods.tempo.stream.storage import MemoryStorage

mpp = Mpp.create(
    method=tempo(
        currency="0x20c0000000000000000000000000000000000000",
        recipient="0xa726a1CD723409074DF9108A2187cfA19899aCF8",
        intents={
            "charge": ChargeIntent(),
            "stream": StreamIntent(
                storage=MemoryStorage(),
                rpc_url="https://rpc.tempo.xyz",
            ),
        },
    ),
)
```

### `tempo()` parameters

### currency (optional)

* **Type:** `str`

Default TIP-20 token address for charges.

### decimals (optional)

* **Type:** `int`
* **Default:** `6`

Token decimal places for amount conversion (6 for pathUSD).

### intents

* **Type:** `dict[str, Intent]`

Intents to register (for example, `charge`, `session`). Each intent must be explicitly provided.

### recipient (optional)

* **Type:** `str`

Default recipient address for charges.

### rpc\_url (optional)

* **Type:** `str`
* **Default:** `"https://rpc.tempo.xyz"`

Tempo RPC endpoint URL.

## `Mpp.create()` parameters

### method

* **Type:** `Method`

Payment method instance returned by `tempo()`.

### realm (optional)

* **Type:** `str`

Server realm for `WWW-Authenticate` headers. Auto-detected from environment if omitted.

### secret\_key (optional)

* **Type:** `str`

HMAC secret for stateless Challenge ID verification. Auto-generated and persisted to `.env` if omitted.

## `charge()` parameters

### amount

* **Type:** `str`

Payment amount in human-readable units (for example, `"0.50"` for $0.50). Automatically converted to base units using the method's decimal precision (6 decimals for pathUSD).

### authorization

* **Type:** `str | None`

The `Authorization` header value from the incoming request.

### currency (optional)

* **Type:** `str`

Override the method's default currency address.

### description (optional)

* **Type:** `str`

Human-readable description attached to the Challenge.

### expires (optional)

* **Type:** `str`

Challenge expiration as ISO 8601 timestamp. Defaults to 5 minutes from now.

### recipient (optional)

* **Type:** `str`

Override the method's default recipient address.

## `session()` parameters

### amount

* **Type:** `str`

Price per unit in human-readable units (for example, `"0.000075"` for $0.000075 per token). Automatically converted to base units.

### authorization

* **Type:** `str | None`

The `Authorization` header value from the incoming request.

### currency (optional)

* **Type:** `str`

Override the method's default currency address.

### description (optional)

* **Type:** `str`

Human-readable description attached to the Challenge.

### recipient (optional)

* **Type:** `str`

Override the method's default recipient address.

### unit\_type (optional)

* **Type:** `str`
* **Default:** `"token"`

Service unit type label (for example, `"token"`, `"byte"`, `"request"`).

## Session example

`StreamIntent` requires a `storage` backend that implements the `ChannelStorage` protocol to persist channel and session state. The SDK ships `MemoryStorage` for development and testing—state lives in a Python dict and is lost on restart. For production, implement `ChannelStorage` backed by your database (Postgres, Redis, and others). The protocol has four methods:

| Method | Description |
|--------|-------------|
| `get_channel(channel_id)` | Look up a channel by ID |
| `get_session(challenge_id)` | Look up a session by Challenge ID |
| `update_channel(channel_id, fn)` | Atomic read-modify-write for channel state |
| `update_session(challenge_id, fn)` | Atomic read-modify-write for session state |

A full SSE endpoint with per-token payment sessions:

```python [server.py]
import asyncio
import json

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, StreamingResponse
from mpp import Challenge
from mpp.methods.tempo import StreamIntent, tempo
from mpp.methods.tempo.stream.storage import MemoryStorage
from mpp.server import Mpp

app = FastAPI()

mpp = Mpp.create(
    method=tempo(
        currency="0x20c0000000000000000000000000000000000000",
        recipient="0xa726a1CD723409074DF9108A2187cfA19899aCF8",
        intents={
            "stream": StreamIntent(
                storage=MemoryStorage(),
                rpc_url="https://rpc.tempo.xyz",
            ),
        },
    ),
)

@app.get("/api/chat")
async def chat(request: Request, prompt: str = "Hello!"):
    result = await mpp.stream(
        authorization=request.headers.get("Authorization"),
        amount="0.000075",
        unit_type="token",
    )

    if isinstance(result, Challenge):
        return JSONResponse(
            status_code=402,
            content={"error": "Payment required"},
            headers={"WWW-Authenticate": result.to_www_authenticate(mpp.realm)},
        )

    credential, receipt = result

    async def event_stream():
        for token in ["The", " answer", " is", " 42."]:
            yield f"data: {json.dumps({'token': token})}\n\n"
            await asyncio.sleep(0.05)
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Payment-Receipt": receipt.to_payment_receipt()},
    )
```

## `@requires_payment` decorator

For the lower-level decorator API, use `@requires_payment` with an explicit intent, request, realm, and secret key:

```python [server.py]
from fastapi import FastAPI, Request
from mpp import Credential, Receipt
from mpp.server import requires_payment
from mpp.methods.tempo import ChargeIntent

app = FastAPI()
intent = ChargeIntent(rpc_url="https://rpc.tempo.xyz")

@app.get("/resource")
@requires_payment(
    intent=intent,
    request={"amount": "1000000", "currency": "0x...", "recipient": "0x..."},
    realm="api.example.com",
    secret_key="my-server-secret",
)
async def get_resource(request: Request, credential: Credential, receipt: Receipt):
    return {"data": "paid content", "payer": credential.source}
```

### Parameters

| Parameter | Description |
|-----------|-------------|
| `intent` | Payment intent for verification |
| `realm` | Server realm for `WWW-Authenticate` |
| `request` | Payment request data (dict or callable) |
| `secret_key` | Secret for Challenge IDs |

# Client \[Handle 402 responses automatically]

Handle `402` Payment Required responses automatically.

## Quick start

Add `.send_with_payment()` to any `reqwest::RequestBuilder`.

```rust
use mpp::client::{PaymentExt, TempoProvider};
use alloy::signers::local::PrivateKeySigner;

let signer = PrivateKeySigner::random();
let provider = TempoProvider::new(signer, "https://rpc.tempo.xyz")?;

let response = reqwest::Client::new()
    .get("https://mpp.dev/api/ping/paid")
    .send_with_payment(&provider)
    .await?;
```

## Key types

| Type | Description |
|------|-------------|
| `PaymentExt` | Extension trait that adds `send_with_payment` |
| `TempoProvider` | Signs and submits Tempo payments |
| `PaymentProvider` | Trait for custom payment methods |

## Middleware (Optional)

All requests automatically handle 402. Requires the `middleware` feature.

```rust
use mpp::client::{PaymentMiddleware, TempoProvider};
use reqwest_middleware::ClientBuilder;

let provider = TempoProvider::new(signer, "https://rpc.tempo.xyz")?;

let client = ClientBuilder::new(reqwest::Client::new())
    .with(PaymentMiddleware::new(provider))
    .build();

let response = client.get("https://mpp.dev/api/ping/paid").send().await?;
```

For custom methods, implement `PaymentProvider` and pass it to `send_with_payment`.

# Server \[Protect endpoints with payment requirements]

Protect endpoints with payment requirements.

## Quick start

Bind method, realm, and secret\_key for stateless verification.

```rust
use mpp::server::{Mpp, tempo_provider, TempoChargeMethod};

let provider = tempo_provider("https://rpc.tempo.xyz")?;
let method = TempoChargeMethod::new(provider);
let payment = Mpp::new(method, "mpp.dev", "my-secret");
```

## Key types

| Type | Description |
|------|-------------|
| `Mpp` | Server helper for challenges and verification |
| `TempoChargeMethod` | Built-in Tempo verification logic |
| `ChargeMethod` | Trait for custom verification |

## Generate a Challenge

```rust
let challenge = payment.charge_challenge(
    "1000000",
    "0x20c0000000000000000000000000000000000000",
    "0xa726a1CD723409074DF9108A2187cfA19899aCF8",
)?;
```

## Verify a Credential

```rust
let receipt = payment.verify(&credential, &request).await?;
println!("Payment verified: {}", receipt.reference);
```

For custom verification, implement `ChargeMethod` and pass it to `Mpp::new`.

# CLI Reference \[Built-in command-line tool for paid HTTP requests]

The `mppx` package includes a CLI for making HTTP requests with automatic payment handling.

## Usage

The `mppx` CLI is bundled with the package.

:::code-group

```bash [npm]
$ npx mppx example.com
```

```bash [pnpm]
$ pnpm mppx example.com
```

```bash [bun]
$ bun mppx example
```

:::

### Global install

To use the `mppx` CLI outside of a project, install globally.

:::code-group

```bash [npm]
$ npm install -g mppx
$ mppx example.com
```

```bash [pnpm]
$ pnpm add -g mppx
$ mppx example.com
```

```bash [bun]
$ bun add -g mppx
$ mppx example.com
```

:::

## Commands and options

:::terminal

```bash
$ mppx --help
```

```txt
// [!include ~/snippets/cli-help.txt]
```

:::

## Environment variables

| Variable | Description |
|----------|-------------|
| `MPPX_ACCOUNT` | Default account name |
| `MPPX_PRIVATE_KEY` | Use a private key directly instead of the keychain |
| `MPPX_RPC_URL` | Default RPC endpoint |
| `MPPX_STRIPE_SECRET_KEY` | Stripe secret key for Stripe payment methods (test mode only: `sk_test_...`) |
| `MPPX_STRIPE_SPT_URL` | Custom Stripe shared payment token endpoint (advanced) |

## Method options

Pass method-specific key-value pairs with `-M` (repeatable):

```bash [terminal]
$ mppx example.com/content -M channel=0x123 -M deposit=1000000
```

For Tempo session payments, use `channel` and `deposit`. For Stripe, use `paymentMethod`.

## Stripe payments

The CLI supports Stripe payment methods. Set your Stripe test-mode secret key and make requests to Stripe-enabled endpoints.

```bash [terminal]
$ export MPPX_STRIPE_SECRET_KEY=sk_test_...
$ mppx https://example.com/content
```

Pass method-specific options with `-M`:

```bash [terminal]
$ mppx https://example.com/content -M paymentMethod=pm_card_visa
```

# `Method.from`

Creates a payment method.

## Usage

```ts twoslash
import { Method, z } from 'mppx'

const tempoCharge = Method.from({
  intent: 'charge',
  name: 'tempo',
  schema: {
    credential: {
      payload: z.object({
        signature: z.string(),
        type: z.literal('transaction'),
      }),
    },
    request: z.object({
      amount: z.string(),
      currency: z.string(),
      recipient: z.string(),
    }),
  },
})
```

## Return type

```ts
type ReturnType = method
```

The method object passed in (identity function for type inference).

## Parameters

### method

#### intent

* **Type:** `string`

Intent name (for example, `"charge"`, `"session"`).

#### name

* **Type:** `string`

Payment method name (for example, `"tempo"`, `"stripe"`).

#### schema

##### credential.payload

* **Type:** `z.ZodMiniType`

Zod schema for the Credential payload.

##### request

* **Type:** `z.ZodMiniType`

Zod schema for the request parameters.

# presto examples \[Real-world usage patterns]

## LLM requests

```bash [llm-requests.sh]
# Chat completion via OpenRouter
$ presto -X POST \
  --json '{"model":"openai/gpt-4o-mini","messages":[{"role":"user","content":"Hello"}]}' \
  https://openrouter.mpp.tempo.xyz/v1/chat/completions

# Chat completion via OpenAI
$ presto -X POST \
  --json '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"Hello"}]}' \
  https://openai.mpp.tempo.xyz/v1/chat/completions

# Chat completion via Anthropic
$ presto -X POST \
  --json '{"model":"claude-sonnet-4-20250514","max_tokens":256,"messages":[{"role":"user","content":"Hello"}]}' \
  https://anthropic.mpp.tempo.xyz/v1/messages

# Preview cost without paying
$ presto --dry-run -X POST \
  --json '{"model":"openai/gpt-4o-mini","messages":[{"role":"user","content":"Hello"}]}' \
  https://openrouter.mpp.tempo.xyz/v1/chat/completions
```

## Image generation

```bash [image-generation.sh]
# Generate an image via fal
$ presto -X POST \
  --json '{"prompt":"A sunset over mountains","image_size":"landscape_4_3","num_images":1}' \
  https://fal.mpp.tempo.xyz/fal-ai/flux/schnell

# Save image response to file
$ presto -o result.json -X POST \
  --json '{"prompt":"A golden retriever in a sunny park","image_size":"square_hd","num_images":1}' \
  https://fal.mpp.tempo.xyz/fal-ai/flux/schnell
```

## Payment sessions

Sessions open a payment channel once, then use off-chain vouchers for subsequent requests (no gas per request):

```bash [sessions.sh]
# First request opens a channel on-chain
$ presto -X POST \
  --json '{"model":"openai/gpt-4o-mini","messages":[{"role":"user","content":"First question"}]}' \
  https://openrouter.mpp.tempo.xyz/v1/chat/completions

# Subsequent requests to the same origin reuse the session
$ presto -X POST \
  --json '{"model":"openai/gpt-4o-mini","messages":[{"role":"user","content":"Second question"}]}' \
  https://openrouter.mpp.tempo.xyz/v1/chat/completions

# View active sessions
$ presto session list

# Close a session when done (reclaims unspent funds)
$ presto session close https://openrouter.mpp.tempo.xyz

# Close all sessions
$ presto session close --all
```

## HTTP options

```bash [http-options.sh]
# Custom headers
$ presto -H "X-Custom: value" -X POST \
  --json '{"model":"openai/gpt-4o-mini","messages":[{"role":"user","content":"Hello"}]}' \
  https://openrouter.mpp.tempo.xyz/v1/chat/completions

# POST data from file
$ presto -d @request.json -X POST \
  https://openrouter.mpp.tempo.xyz/v1/chat/completions

# POST data from stdin
$ echo '{"model":"openai/gpt-4o-mini","messages":[{"role":"user","content":"Hello"}]}' \
  | presto -d @- -X POST https://openrouter.mpp.tempo.xyz/v1/chat/completions

# Set timeout
$ presto -m 30 -X POST \
  --json '{"model":"openai/gpt-4o-mini","messages":[{"role":"user","content":"Hello"}]}' \
  https://openrouter.mpp.tempo.xyz/v1/chat/completions
```

## Output control

```bash [output-control.sh]
# Quiet mode (suppress logs, recommended for agents)
$ presto -q -X POST \
  --json '{"model":"openai/gpt-4o-mini","messages":[{"role":"user","content":"Hello"}]}' \
  https://openrouter.mpp.tempo.xyz/v1/chat/completions

# Include HTTP response headers
$ presto -i -X POST \
  --json '{"model":"openai/gpt-4o-mini","messages":[{"role":"user","content":"Hello"}]}' \
  https://openrouter.mpp.tempo.xyz/v1/chat/completions

# JSON output format
$ presto --output-format json -X POST \
  --json '{"model":"openai/gpt-4o-mini","messages":[{"role":"user","content":"Hello"}]}' \
  https://openrouter.mpp.tempo.xyz/v1/chat/completions

# Verbose to see the full 402 payment flow
$ presto -v -X POST \
  --json '{"model":"openai/gpt-4o-mini","messages":[{"role":"user","content":"Hello"}]}' \
  https://openrouter.mpp.tempo.xyz/v1/chat/completions
```

## Wallet status

```bash [wallet.sh]
# Show wallet address, balances, and access keys
$ presto whoami

# JSON output (for agents)
$ presto whoami --output-format json
```

# `tempo` \[Register all Tempo intents]

Convenience function that creates both `tempo.charge` and `tempo.session` method intents with shared configuration.

## Usage

```ts twoslash
import { Mppx, tempo } from 'mppx/client'
import { privateKeyToAccount } from 'viem/accounts'

const account = privateKeyToAccount('0xabc…123')

Mppx.create({
  methods: [
    // [!code focus:start]
    tempo({ account }),
    // [!code focus:end]
  ],
})
```

This is equivalent to:

```ts twoslash
import { Mppx, tempo } from 'mppx/client'
import { privateKeyToAccount } from 'viem/accounts'

const account = privateKeyToAccount('0xabc…123')

Mppx.create({
  methods: [
    tempo.charge({ account }),
    tempo.session({ account }),
  ],
})
```

## Return type

```ts
type ReturnType = readonly [Method.Client, Method.Client]
```

A tuple of `[charge, session]` methods. `Mppx.create` accepts tuples in the `methods` array and flattens them automatically.

## Parameters

Accepts the union of [`tempo.charge`](/sdk/typescript/client/Method.tempo.charge) and [`tempo.session`](/sdk/typescript/client/Method.tempo.session) parameters. The most common are listed below.

### account (optional)

* **Type:** `Account`

Account to sign transactions and vouchers with.

### deposit (optional)

* **Type:** `string`

Initial deposit amount in human-readable units (for example `"10"` for 10 tokens). Enables automatic session channel management.

### getClient (optional)

* **Type:** `(parameters: { chainId?: number }) => MaybePromise<Client>`

Function that returns a viem client for the given chain ID.

### maxDeposit (optional)

* **Type:** `string`

Maximum deposit in human-readable units. Caps the server's `suggestedDeposit`. Enables auto-management like `deposit`.

# `Method.tempo.charge` \[One-time payments]

Creates a Tempo charge payment method for client-side transaction signing.

## Usage

```ts twoslash
import { Mppx, tempo } from 'mppx/client'
import { privateKeyToAccount } from 'viem/accounts'

const account = privateKeyToAccount('0xabc…123')

Mppx.create({
  methods: [
    // [!code focus:start]
    tempo.charge({ account }),
    // [!code focus:end]
  ],
})

const response = await fetch('https://mpp.dev/api/ping/paid')
```

## Return type

```ts
import type { Method } from 'mppx'

type ReturnType = Method.Client
```

## Parameters

### account (optional)

* **Type:** `Account`

Account to sign transactions with. You can override this per call using the context.

```ts twoslash
import { tempo } from 'mppx/client'
import { privateKeyToAccount } from 'viem/accounts'

const method = tempo.charge({
  account: privateKeyToAccount('0xabc…123'), // [!code focus]
})
```

### clientId (optional)

* **Type:** `string`

Client identifier used to derive the client fingerprint in attribution memos.

### getClient (optional)

* **Type:** `(parameters: { chainId: number }) => MaybePromise<Client>`

Function that returns a viem client for the given chain ID.

# `Method.tempo.session` \[Low-cost high-throughput payments]

Creates a Tempo payment session method for client-side voucher signing.

## Usage

```ts twoslash
import { Mppx, tempo } from 'mppx/client'
import { privateKeyToAccount } from 'viem/accounts'

const account = privateKeyToAccount('0xabc…123')

Mppx.create({
  methods: [
    // [!code focus:start]
    tempo.session({ account }),
    // [!code focus:end]
  ],
})
```

### With charge and session

Register both intents on a single client.

```ts twoslash
import { Mppx, tempo } from 'mppx/client'
import { privateKeyToAccount } from 'viem/accounts'

const account = privateKeyToAccount('0xabc…123')

Mppx.create({
  methods: [
    tempo.charge({ account }),
    tempo.session({ account }),
  ],
})
```

## Return type

```ts
import type { Method } from 'mppx'

type ReturnType = Method.Client
```

## Parameters

### account (optional)

* **Type:** `Account`

Account to sign vouchers with. You can override this per call using the context.

```ts twoslash
import { tempo } from 'mppx/client'
import { privateKeyToAccount } from 'viem/accounts'

const method = tempo.session({
  account: privateKeyToAccount('0xabc…123'), // [!code focus]
})
```

### authorizedSigner (optional)

* **Type:** `Address`

Address authorized to sign vouchers. Defaults to the account address. Use when a separate access key (for example, secp256k1) signs vouchers while the root account funds the channel.

### decimals (optional)

* **Type:** `number`
* **Default:** `6`

Token decimals for parsing human-readable amounts.

### deposit (optional)

* **Type:** `string`

Initial deposit amount in human-readable units (for example `"10"` for 10 tokens). When set, the client handles the full channel lifecycle (open, voucher, cumulative tracking) automatically.

### escrowContract (optional)

* **Type:** `Address`

Escrow contract address override. Derived from the server challenge if not provided.

### getClient (optional)

* **Type:** `(parameters: { chainId: number }) => MaybePromise<Client>`

Function that returns a viem client for the given chain ID.

### maxDeposit (optional)

* **Type:** `string`

Maximum deposit in human-readable units (for example `"10"`). Caps the server's `suggestedDeposit`. Enables auto-management like `deposit`.

### onChannelUpdate (optional)

* **Type:** `(entry: ChannelEntry) => void`

Called whenever channel state changes (open, voucher, close, recovery).

# `Mppx.create`

Creates a client-side payment handler. Returns a payment handler with a `fetch` function that automatically handles `402` Payment Required responses. By default, also polyfills `globalThis.fetch`.

## Usage

```ts twoslash
import { Mppx, tempo } from 'mppx/client'
import { privateKeyToAccount } from 'viem/accounts'

const account = privateKeyToAccount('0x...')

Mppx.create({
  methods: [tempo({ account })],
})

// Global fetch now handles 402 automatically
const res = await fetch('https://mpp.dev/api/ping/paid')
```

### Without polyfill

Set `polyfill: false` to get a scoped fetch without modifying the global:

```ts twoslash
import { Mppx, tempo } from 'mppx/client'
import { privateKeyToAccount } from 'viem/accounts'

const account = privateKeyToAccount('0x...')

const mppx = Mppx.create({
  polyfill: false, // [!code hl]
  methods: [tempo({ account })],
})

// Use the returned fetch // [!code hl]
const res = await mppx.fetch('https://mpp.dev/api/ping/paid') // [!code hl]
```

### Manual credential handling

For full control over the payment flow:

```ts twoslash
import { Mppx, tempo } from 'mppx/client'
import { privateKeyToAccount } from 'viem/accounts'

const mppx = Mppx.create({
  polyfill: false, // [!code hl]
  methods: [tempo()],
})

// [!code hl:start]
const response = await fetch('https://mpp.dev/api/ping/paid')

if (response.status === 402) {
  const credential = await mppx.createCredential(response, {
    account: privateKeyToAccount('0x...'),
  })

  const paidResponse = await fetch('https://mpp.dev/api/ping/paid', {
    headers: { Authorization: credential },
  })
}
// [!code hl:end]
```

## Return type

```ts
type Mppx = {
  /** Payment-aware fetch function that automatically handles 402 responses. */
  fetch: Fetch
  /** The configured payment methods. */
  methods: readonly Method.Client[]
  /** The transport used. */
  transport: Transport
  /** Creates a credential from a payment-required response. */
  createCredential: (
    response: Response,
    context?: Context,
  ) => Promise<string>
}
```

## Parameters

### fetch (optional)

* **Type:** `typeof globalThis.fetch`
* **Default:** `globalThis.fetch`

Custom fetch function to wrap.

```ts twoslash
import { Mppx, tempo } from 'mppx/client'
import { privateKeyToAccount } from 'viem/accounts'

const customFetch = globalThis.fetch

const account = privateKeyToAccount('0x...')

const mppx = Mppx.create({
  fetch: customFetch, // [!code focus]
  methods: [tempo({ account })],
})
```

### methods

* **Type:** `readonly Method.Client[]`

Array of payment methods to use.

```ts twoslash
import { Mppx, tempo } from 'mppx/client'
import { privateKeyToAccount } from 'viem/accounts'

const account = privateKeyToAccount('0x...')

const mppx = Mppx.create({
  // [!code focus:start]
  methods: [tempo({ account })],
  // [!code focus:end]
})
```

### onChallenge (optional)

* **Type:** `(challenge: Challenge, helpers: { createCredential: (context?) => Promise<string> }) => Promise<string | undefined>`

Called when a `402` challenge is received, before credential creation. Return a credential string to use it directly, or `undefined` to fall back to the default credential flow.

```ts twoslash
import { Mppx, tempo } from 'mppx/client'
import { privateKeyToAccount } from 'viem/accounts'

const account = privateKeyToAccount('0x...')

const mppx = Mppx.create({
  methods: [tempo({ account })],
  onChallenge: async (challenge, { createCredential }) => { // [!code focus:start]
    console.log('Challenge received:', challenge.method)
    return createCredential()
  }, // [!code focus:end]
})
```

### polyfill (optional)

* **Type:** `boolean`
* **Default:** `true`

Whether to polyfill `globalThis.fetch` with the payment-aware wrapper.

```ts twoslash
import { Mppx, tempo } from 'mppx/client'
import { privateKeyToAccount } from 'viem/accounts'

const account = privateKeyToAccount('0x...')

const mppx = Mppx.create({
  polyfill: false, // [!code focus]
  methods: [tempo({ account })],
})
```

### transport (optional)

* **Type:** `Transport`
* **Default:** `Transport.http()`

Transport to use for extracting challenges and attaching credentials.

```ts twoslash
import { Mppx, Transport, tempo } from 'mppx/client'
import { privateKeyToAccount } from 'viem/accounts'

const account = privateKeyToAccount('0x...')

const mppx = Mppx.create({
  methods: [tempo({ account })],
  transport: Transport.mcp(), // [!code focus]
})
```

# `Mppx.restore`

Restores the original `fetch` after `Mppx.create()` polyfilled it.

## Usage

```ts twoslash
import { Mppx, tempo } from 'mppx/client'
import { privateKeyToAccount } from 'viem/accounts'

const account = privateKeyToAccount('0x...')

Mppx.create({
  methods: [tempo({ account })],
})

// ... use payment-aware fetch ...

Mppx.restore()
```

## Return type

```ts
void
```

## Parameters

None.

# `Transport.from`

Creates a custom client-side transport.

## Usage

```ts twoslash
import { Challenge } from 'mppx'
import { Transport } from 'mppx/client'

const http = Transport.from<RequestInit, Response>({
  name: 'http',
  isPaymentRequired(response) {
    return response.status === 402
  },
  getChallenge(response) {
    return Challenge.fromResponse(response)
  },
  setCredential(request, credential) {
    const headers = new Headers(request.headers)
    headers.set('Authorization', credential)
    return { ...request, headers }
  },
})
```

## Return type

```ts
type Transport<request, response> = {
  /** Transport name for identification. */
  name: string
  /** Checks if a response indicates payment is required. */
  isPaymentRequired: (response: response) => boolean
  /** Extracts the challenge from a payment-required response. */
  getChallenge: (response: response) => Challenge
  /** Attaches a credential to a request. */
  setCredential: (request: request, credential: string) => request
}
```

## Parameters

### getChallenge

* **Type:** `(response: Response) => Challenge`

Function that extracts the challenge from a payment-required response.

### isPaymentRequired

* **Type:** `(response: Response) => boolean`

Function that checks if a response indicates payment is required.

### name

* **Type:** `string`

Transport name for identification.

### setCredential

* **Type:** `(request: Request, credential: string) => Request`

Function that attaches a credential to a request.

# `Transport.http`

HTTP transport for client-side payment handling.

## Usage

```ts twoslash
import { Mppx, Transport, tempo } from 'mppx/client'
import { privateKeyToAccount } from 'viem/accounts'

const account = privateKeyToAccount('0x...')

const mppx = Mppx.create({
  methods: [tempo({ account })],
  transport: Transport.http(), // [!code focus]
})
```

## Behavior

* Detects payment required using the **`402` status code**
* Extracts challenges from the **`WWW-Authenticate` header**
* Sends credentials using the **`Authorization` header**

## Return type

```ts
type HttpTransport = Transport<RequestInit, Response>
```

## Parameters

None.

# `Transport.mcp`

MCP transport for client-side payment handling.

## Usage

```ts twoslash
import { Mppx, Transport, tempo } from 'mppx/client'
import { privateKeyToAccount } from 'viem/accounts'

const account = privateKeyToAccount('0x...')

const mppx = Mppx.create({
  methods: [tempo({ account })],
  transport: Transport.mcp(), // [!code focus]
})
```

## Behavior

* Detects payment required using **error code `-32042`**
* Extracts challenges from **`error.data.challenges[0]`**
* Sends credentials using **`_meta["org.paymentauth/credential"]`**

## Return type

```ts
type McpTransport = Transport<Mcp.Request, Mcp.Response>
```

## Parameters

None.

# `BodyDigest.compute`

Computes a SHA-256 digest of the given body.

## Usage

```ts twoslash
import { BodyDigest } from 'mppx'

const digest = BodyDigest.compute({ amount: '1000' })
// => 'sha-256=X48E9qOokqqrvdts8nOJRJN3OWDUoyWxBf7kbu9DBPE'
```

## Return type

```ts
type ReturnType = `sha-256=${string}`
```

A digest string in the format `sha-256=base64hash`.

## Parameters

### body

* **Type:** `Record<string, unknown> | string`

The body to digest. Can be a JSON object or a string.

# `BodyDigest.verify`

Verifies that a digest matches the given body.

## Usage

```ts twoslash
import { BodyDigest } from 'mppx'

const digest = BodyDigest.compute({ amount: '1000' })
const isValid = BodyDigest.verify(digest, '{"amount":"1000"}')
// => true
```

## Return type

```ts
type ReturnType = boolean
```

`true` if the digest matches, `false` otherwise.

## Parameters

### body

* **Type:** `Record<string, unknown> | string`

The body to verify against.

### digest

* **Type:** `` `sha-256=${string}` ``

The digest to verify.

# `Challenge.deserialize`

Deserializes a WWW-Authenticate header value to a challenge.

## Usage

```ts twoslash
import { Challenge } from 'mppx'

const header = 'Payment id="abc123", realm="mpp.dev", method="tempo", intent="charge", request="eyJhbW91bnQiOi..."'
const challenge = Challenge.deserialize(header)
```

### With method type narrowing

Use a method definition to get type-safe access to method-specific request fields.

```ts twoslash
import { Challenge } from 'mppx'
import { Methods } from 'mppx/tempo'

const header = 'Payment id="abc123", realm="mpp.dev", method="tempo", intent="charge", request="eyJhbW91bnQiOi..."'
const challenge = Challenge.deserialize(header, { methods: [Methods.charge] })
```

## Return type

```ts
type ReturnType = Challenge
```

The deserialized Challenge object. If the serialized header contains an `opaque` parameter, it is deserialized and stored as `opaque` on the Challenge (accessible via `Challenge.meta`).

## Parameters

### options (optional)

* **Type:** `{ methods?: readonly Method.Method[] }`

Optional settings to narrow the Challenge type using method intents.

### value

* **Type:** `string`

The WWW-Authenticate header value.

# `Challenge.from`

Creates a challenge from the given parameters.

If `secretKey` option is provided, the challenge ID is computed as HMAC-SHA256 over the challenge parameters (realm|method|intent|request|expires|digest|opaque), cryptographically binding the ID to its contents.

## Usage

```ts twoslash
import { Challenge } from 'mppx'

// With HMAC-bound ID (recommended for servers)
const challenge = Challenge.from(
  {
    realm: 'mpp.dev',
    method: 'tempo',
    intent: 'charge',
    request: { amount: '1000000', currency: '0x...', recipient: '0x...' },
    secretKey: 'my-secret',
  },
)
```

### With explicit ID

Use an explicit ID when you don't need HMAC-bound challenge verification.

```ts twoslash
import { Challenge } from 'mppx'

const challenge = Challenge.from({
  id: 'abc123',
  realm: 'mpp.dev',
  method: 'tempo',
  intent: 'charge',
  request: { amount: '1000000', currency: '0x...', recipient: '0x...' },
})
```

## Return type

```ts
type ReturnType = Challenge
```

A challenge object.

## Parameters

### parameters

Challenge parameters. Must include either `id` or `secretKey`.

#### description (optional)

* **Type:** `string`

Human-readable description of the payment.

#### digest (optional)

* **Type:** `string`

Digest of the request body.

#### expires (optional)

* **Type:** `string`

Expiration timestamp (ISO 8601).

#### id (when not using secretKey)

* **Type:** `string`

Explicit challenge ID.

#### intent

* **Type:** `string`

Intent type (for example, `"charge"`, `"session"`).

#### meta (optional)

* **Type:** `Record<string, string>`

Server-defined correlation data, serialized as `opaque` on the Challenge.

#### method

* **Type:** `string`

Payment method (for example, "tempo", "stripe").

#### realm

* **Type:** `string`

Server realm (for example, hostname).

#### request

* **Type:** `Record<string, unknown>`

Method-specific request data.

#### secretKey (when not using id)

* **Type:** `string`

Secret key for HMAC-bound challenge ID.

# `Challenge.fromHeaders`

Extracts the challenge from a Headers object.

## Usage

```ts twoslash
import { Challenge } from 'mppx'

const response = await fetch('/resource')
const challenge = Challenge.fromHeaders(response.headers)
```

### With method type narrowing

Use a method definition to get type-safe access to method-specific request fields.

```ts twoslash
import { Challenge } from 'mppx'
import { Methods } from 'mppx/tempo'

const response = await fetch('/resource')
const challenge = Challenge.fromHeaders(response.headers, { methods: [Methods.charge] })
```

## Return type

```ts
type ReturnType = Challenge
```

The deserialized challenge object.

## Parameters

### headers

* **Type:** `Headers`

The HTTP headers object.

### options (optional)

* **Type:** `{ methods?: readonly Method.Method[] }`

Optional settings to narrow the Challenge type using method intents.

# `Challenge.fromMethod`

Creates a validated Challenge from a method definition.

## Usage

```ts twoslash
import { Challenge } from 'mppx'
import { Methods } from 'mppx/tempo'

const challenge = Challenge.fromMethod(
  Methods.charge,
  {
    realm: 'mpp.dev',
    request: {
      amount: '1',
      currency: '0x20c0000000000000000000000000000000000001',
      decimals: 6,
      recipient: '0x742d35Cc6634C0532925a3b844Bc9e7595f8fE00',
    },
    secretKey: 'my-secret',
  },
)
```

## Return type

```ts
type ReturnType = Challenge<RequestOutput>
```

A Challenge typed to the method's request schema output.

## Parameters

### method

* **Type:** `Method`

The method definition to validate against (for example, `Methods.charge`).

### parameters

Challenge parameters. Must include either `id` or `secretKey`.

#### description (optional)

* **Type:** `string`

Human-readable description of the payment.

#### digest (optional)

* **Type:** `string`

Digest of the request body.

#### expires (optional)

* **Type:** `string`

Expiration timestamp (ISO 8601).

#### id (when not using secretKey)

* **Type:** `string`

Explicit challenge ID.

#### meta (optional)

* **Type:** `Record<string, string>`

Server-defined correlation data. Serialized as `opaque` on the Challenge.

#### realm

* **Type:** `string`

Server realm (for example, hostname).

#### request

* **Type:** `z.input<method['schema']['request']>`

Method-specific request data, validated against the method's schema.

#### secretKey (when not using id)

* **Type:** `string`

Secret key for HMAC-bound challenge ID.

# `Challenge.fromResponse`

Extracts the challenge from a Response's WWW-Authenticate header.

## Usage

```ts twoslash
import { Challenge } from 'mppx'

const response = await fetch('/resource')
if (response.status === 402) {
  const challenge = Challenge.fromResponse(response)
}
```

### With method type narrowing

Use a method definition to get type-safe access to method-specific request fields.

```ts twoslash
import { Challenge } from 'mppx'
import { Methods } from 'mppx/tempo'

const response = await fetch('/resource')
if (response.status === 402) {
  const challenge = Challenge.fromResponse(response, { methods: [Methods.charge] })
}
```

## Return type

```ts
type ReturnType = Challenge
```

The deserialized challenge object.

## Parameters

### response

* **Type:** `Response`

The HTTP response (must be `402` status).

### options (optional)

* **Type:** `{ methods?: readonly Method.Method[] }`

Optional settings to narrow the Challenge type using method intents.

# `Challenge.meta`

Extracts server-defined correlation data from a Challenge.

## Usage

```ts twoslash
import { Challenge } from 'mppx'

declare const challenge: Challenge.Challenge
// ---cut---
const data = Challenge.meta(challenge)
```

## Return type

```ts
type ReturnType = Record<string, string> | undefined
```

The `opaque` field from the Challenge, or `undefined` if not set.

## Parameters

### challenge

* **Type:** `Challenge`

The Challenge to extract correlation data from.

# `Challenge.serialize`

Serializes a challenge to the WWW-Authenticate header format.

## Usage

```ts twoslash
import { Challenge } from 'mppx'

const challenge = Challenge.from({
  id: 'abc123',
  realm: 'mpp.dev',
  method: 'tempo',
  intent: 'charge',
  request: { amount: '1000000', currency: '0x...', recipient: '0x...' },
})

const header = Challenge.serialize(challenge)
// @log: 'Payment id="abc123", realm="mpp.dev", method="tempo", intent="charge", request="eyJhbW91bnQiOi..."'
```

## Return type

```ts
type ReturnType = string
```

A string suitable for the WWW-Authenticate header value.

The serialized string includes optional fields when present: `description`, `digest`, `expires`, and `opaque` (server-defined correlation data set via `meta` in `Challenge.from`).

## Parameters

### challenge

* **Type:** `Challenge`

The challenge to serialize.

# `Challenge.verify`

Verifies that a challenge ID matches the expected HMAC for the given parameters.

## Usage

```ts twoslash
import { Challenge } from 'mppx'

const challenge = Challenge.from({
  realm: 'mpp.dev',
  method: 'tempo',
  intent: 'charge',
  request: { amount: '1000000', currency: '0x...', recipient: '0x...' },
  secretKey: 'my-secret',
})

const isValid = Challenge.verify(challenge, { secretKey: 'my-secret' })
// => true
```

## Return type

```ts
type ReturnType = boolean
```

`true` if the challenge ID is valid, `false` otherwise.

## Parameters

### challenge

* **Type:** `Challenge`

The challenge to verify.

### options

#### secretKey

* **Type:** `string`

Secret key for HMAC-bound challenge ID verification.

# `Credential.deserialize`

Deserializes an Authorization header value to a credential.

## Usage

```ts twoslash
import { Credential } from 'mppx'

const header = 'Payment eyJjaGFsbGVuZ2UiOnsi...'
const credential = Credential.deserialize(header)
```

## Return type

```ts
type ReturnType = Credential<payload>
```

The deserialized credential object.

## Parameters

### value

* **Type:** `string`

The Authorization header value.

# `Credential.from`

Creates a credential from the given parameters.

## Usage

```ts twoslash
import { Credential, Challenge } from 'mppx'

const challenge = Challenge.from({
  id: 'abc123',
  realm: 'mpp.dev',
  method: 'tempo',
  intent: 'charge',
  request: { amount: '1000000', currency: '0x...', recipient: '0x...' },
})

const credential = Credential.from({
  challenge,
  payload: { signature: '0x...' },
})
```

## Return type

```ts
type ReturnType = Credential<payload, challenge>
```

A credential object containing the challenge and payment proof.

## Parameters

### parameters

#### challenge

* **Type:** `Challenge`

The challenge from the `402` response.

#### payload

* **Type:** `unknown`

Method-specific payment proof.

#### source (optional)

* **Type:** `string`

Payer identifier as a DID (for example, "did:pkh:eip155:1:0x...").

# `Credential.fromRequest`

Extracts the credential from a Request's Authorization header.

## Usage

```ts twoslash
import { Credential } from 'mppx'

export async function handler(request: Request) {
  const credential = Credential.fromRequest(request)
  // ...
}
```

## Return type

```ts
type ReturnType = Credential<payload>
```

The deserialized credential object.

## Parameters

### request

* **Type:** `Request`

The HTTP request.

# `Credential.serialize`

Serializes a credential to the Authorization header format.

## Usage

```ts twoslash
import { Credential, Challenge } from 'mppx'

const challenge = Challenge.from({
  id: 'abc123',
  realm: 'mpp.dev',
  method: 'tempo',
  intent: 'charge',
  request: { amount: '1000000', currency: '0x...', recipient: '0x...' },
})

const credential = Credential.from({
  challenge,
  payload: { signature: '0x...' },
})

const header = Credential.serialize(credential)
// => 'Payment eyJjaGFsbGVuZ2UiOnsi...'
```

## Return type

```ts
type ReturnType = string
```

A string suitable for the Authorization header value.

## Parameters

### credential

* **Type:** `Credential`

The credential to serialize.

# `Expires`

Utility functions for generating ISO 8601 datetime strings relative to the current time.

## Usage

```ts twoslash
import { Expires } from 'mppx'

// Expire in 30 seconds
const in30Seconds = Expires.seconds(30)

// Expire in 5 minutes
const in5Minutes = Expires.minutes(5)

// Expire in 2 hours
const in2Hours = Expires.hours(2)

// Expire in 7 days
const in7Days = Expires.days(7)

// Expire in 2 weeks
const in2Weeks = Expires.weeks(2)

// Expire in 3 months
const in3Months = Expires.months(3)

// Expire in 1 year
const in1Year = Expires.years(1)
```

## Functions

### seconds

Returns an ISO 8601 datetime string `n` seconds from now.

```ts
function seconds(n: number): string
```

### minutes

Returns an ISO 8601 datetime string `n` minutes from now.

```ts
function minutes(n: number): string
```

### hours

Returns an ISO 8601 datetime string `n` hours from now.

```ts
function hours(n: number): string
```

### days

Returns an ISO 8601 datetime string `n` days from now.

```ts
function days(n: number): string
```

### weeks

Returns an ISO 8601 datetime string `n` weeks from now.

```ts
function weeks(n: number): string
```

### months

Returns an ISO 8601 datetime string `n` months (30 days) from now.

```ts
function months(n: number): string
```

### years

Returns an ISO 8601 datetime string `n` years (365 days) from now.

```ts
function years(n: number): string
```

## Return type

All functions return:

```ts
type ReturnType = string
```

An ISO 8601 datetime string (for example, `"2025-01-15T12:30:00.000Z"`).

## Parameters

### n

* **Type:** `number`

The number of time units from now.

# `Method.from`

Creates a payment method definition.

## Usage

```ts twoslash [tempo/methods.ts]
import { Method, z } from 'mppx'

const charge = Method.from({
  intent: 'charge',
  name: 'tempo',
  schema: {
    credential: {
      payload: z.object({
        signature: z.string(),
        type: z.literal('transaction'),
      }),
    },
    request: z.object({
      amount: z.string(),
      currency: z.string(),
      recipient: z.string(),
    }),
  },
})
```

## Return type

```ts
type ReturnType = method
```

The method object passed in (identity function for type inference).

## Parameters

### method

Payment method definition.

#### intent

* **Type:** `string`

Intent type (for example, `"charge"`, `"session"`).

#### name

* **Type:** `string`

Payment method name (for example, `"tempo"`, `"stripe"`).

#### schema

* **Type:** `{ credential: { payload: ZodMiniType }, request: ZodMiniType }`

Zod schemas for validating Credential payloads and request parameters.

# `Method.toClient`

Extends a payment method with client-side Credential creation logic.

## Usage

::::code-group

```ts twoslash [methods.client.ts]
import { Mppx } from 'mppx/client'
import { Credential, Method } from 'mppx' // [!code focus]
import * as Methods from './methods' // [!code focus]

// [!code focus:start]
// Create client-configured method.
const charge = Method.toClient(Methods.charge, {
  async createCredential({ challenge }) {
    const payload = { signature: '0x...', type: 'transaction' as const }
    return Credential.serialize({ challenge, payload })
  },
})
// [!code focus:end]

// Create Mppx client with the method configured.
Mppx.create({
  methods: [charge],
})
```

```ts twoslash [methods.ts] filename="methods.ts"
import { Method, z } from 'mppx'

export const charge = Method.from({
  intent: 'charge',
  name: 'tempo',
  schema: {
    credential: {
      payload: z.object({
        signature: z.string(),
        type: z.literal('transaction'),
      }),
    },
    request: z.object({
      amount: z.string(),
      currency: z.string(),
      recipient: z.string(),
    }),
  },
})
```

::::

## Return type

```ts
type ReturnType = Method.Client<method, context>
```

A client-configured method that can be passed to `Mppx.create`.

## Parameters

### method

* **Type:** `Method`

The base payment method definition (created with `Method.from`).

### options

#### context (optional)

* **Type:** `ZodMiniType`

Zod schema for additional context passed to `createCredential`.

#### createCredential

* **Type:** `(parameters: { challenge: Challenge; context?: context }) => Promise<string>`

Function that creates a serialized Credential string from a Challenge.

# `Method.toServer`

Extends a payment method with server-side verification logic.

## Usage

::::code-group

```ts twoslash [methods.server.ts]
import { Mppx } from 'mppx/server'
import { Method, Receipt } from 'mppx' // [!code focus]
import * as Methods from './methods' // [!code focus]

// [!code focus:start]
// Create server-configured method.
const charge = Method.toServer(Methods.charge, {
  async verify({ credential, request }) {
    return Receipt.from({
      method: 'tempo',
      reference: '0x...',
      status: 'success',
      timestamp: new Date().toISOString(),
    })
  },
})
// [!code focus:end]

// Create Mppx server with the method configured.
const mppx = Mppx.create({
  methods: [charge],
})
```

```ts twoslash [methods.ts] filename="methods.ts"
import { Method, z } from 'mppx'

export const charge = Method.from({
  intent: 'charge',
  name: 'tempo',
  schema: {
    credential: {
      payload: z.object({
        signature: z.string(),
        type: z.literal('transaction'),
      }),
    },
    request: z.object({
      amount: z.string(),
      currency: z.string(),
      recipient: z.string(),
    }),
  },
})
```

::::

## Return type

```ts
type ReturnType = Method.Server<method, defaults, transportOverride>
```

A server-configured method that can be passed to `Mppx.create`.

## Parameters

### method

* **Type:** `Method`

The base payment method definition (created with `Method.from`).

### options

#### defaults (optional)

* **Type:** `Partial<request>`

Default request parameters merged into every Challenge issued for this method.

#### request (optional)

* **Type:** `(options: { credential?: Credential; request: request }) => request`

Transform function called before Challenge creation. Use to modify or enrich request parameters.

#### respond (optional)

* **Type:** `(parameters: { credential: Credential; input: Request; receipt: Receipt; request: request }) => Response | undefined`

Called after `verify` succeeds. Return a `Response` to short-circuit the handler (for example, for channel open/close management responses). Return `undefined` to let the server handler serve content via `withReceipt(response)`. HTTP-only—MCP transports do not invoke this hook.

#### transport (optional)

* **Type:** `Transport`

Override the transport for this method.

#### verify

* **Type:** `(parameters: { credential: Credential; request: request }) => Promise<Receipt>`

Function that verifies a Credential and returns a Receipt.

# `PaymentRequest.deserialize`

Deserializes a base64url string to a payment request.

## Usage

```ts twoslash
import { PaymentRequest } from 'mppx'

const encoded = 'eyJhbW91bnQiOiIxMDAwMDAwIiwiY3VycmVuY3kiOiIweC4uLiJ9'
const request = PaymentRequest.deserialize(encoded)
```

## Return type

```ts
type ReturnType = Request
```

The deserialized request object.

## Parameters

### encoded

* **Type:** `string`

The base64url-encoded string.

# `PaymentRequest.from`

Creates a payment request from the given parameters.

## Usage

```ts twoslash
import { PaymentRequest } from 'mppx'

const request = PaymentRequest.from({
  amount: '1000000',
  currency: '0x20c0000000000000000000000000000000000000',
  recipient: '0xa726a1CD723409074DF9108A2187cfA19899aCF8',
})
```

## Return type

```ts
type ReturnType = request
```

The request object passed in (identity function for type inference).

## Parameters

### request

* **Type:** `Record<string, unknown>`

Request parameters. The shape depends on the intent being used.

# `PaymentRequest.serialize`

Serializes a payment request to a base64url string.

## Usage

```ts twoslash
import { PaymentRequest } from 'mppx'

const request = PaymentRequest.from({
  amount: '1000000',
  currency: '0x20c0000000000000000000000000000000000000',
  recipient: '0xa726a1CD723409074DF9108A2187cfA19899aCF8',
})

const serialized = PaymentRequest.serialize(request)
// => "eyJhbW91bnQiOiIxMDAwMDAwIiwiY3VycmVuY3kiOiIweC4uLiJ9"
```

## Return type

```ts
type ReturnType = string
```

A base64url-encoded string (no padding).

## Parameters

### request

* **Type:** `Request`

The request to serialize.

# `Receipt.deserialize`

Deserializes a Payment-Receipt header value to a receipt.

## Usage

```ts twoslash
import { Receipt } from 'mppx'

const encoded = 'eyJzdGF0dXMiOiJzdWNjZXNzIiwidGltZXN0YW1wIjoi...'
const receipt = Receipt.deserialize(encoded)
```

## Return type

```ts
type ReturnType = Receipt
```

The deserialized receipt object.

## Parameters

### encoded

* **Type:** `string`

The base64url-encoded header value.

# `Receipt.from`

Creates a receipt from the given parameters.

## Usage

```ts twoslash
import { Receipt } from 'mppx'

const receipt = Receipt.from({
  method: 'tempo',
  status: 'success',
  timestamp: new Date().toISOString(),
  reference: '0x...',
})
```

## Return type

```ts
type ReturnType = Receipt
```

A validated receipt object.

## Parameters

### parameters

#### externalId (optional)

* **Type:** `string`

External reference ID echoed from the Credential payload.

#### method

* **Type:** `string`

Payment method used (for example, "tempo", "stripe").

#### reference

* **Type:** `string`

Method-specific reference (for example, transaction hash).

#### status

* **Type:** `'success'`

Payment status.

#### timestamp

* **Type:** `string`

RFC 3339 settlement timestamp.

# `Receipt.fromResponse`

Extracts the receipt from a Response's Payment-Receipt header.

## Usage

```ts twoslash
import { Receipt } from 'mppx'

const response = await fetch('/resource', {
  headers: { Authorization: 'Payment ...' },
})

if (response.ok) {
  const receipt = Receipt.fromResponse(response)
}
```

## Return type

```ts
type ReturnType = Receipt
```

The deserialized receipt object.

## Parameters

### response

* **Type:** `Response`

The HTTP response.

# `Receipt.serialize`

Serializes a receipt to the Payment-Receipt header format.

## Usage

```ts twoslash
import { Receipt } from 'mppx'

const receipt = Receipt.from({
  method: 'tempo',
  status: 'success',
  timestamp: new Date().toISOString(),
  reference: '0x...',
})

const header = Receipt.serialize(receipt)
// => "eyJzdGF0dXMiOiJzdWNjZXNzIiwidGltZXN0YW1wIjoi..."
```

## Return type

```ts
type ReturnType = string
```

A base64url-encoded string suitable for the Payment-Receipt header value.

## Parameters

### receipt

* **Type:** `Receipt`

The receipt to serialize.

# Elysia \[Payment middleware for Elysia]

Native [Elysia](https://elysiajs.com) middleware that gates routes behind payment intents.

## Install

:::code-group

```bash [npm]
npm install mppx elysia
```

```bash [pnpm]
pnpm add mppx elysia
```

```bash [bun]
bun add mppx elysia
```

:::

## Usage

Import `Mppx` and `tempo` from `mppx/elysia` to create an Elysia-aware payment handler. Each intent (for example, `charge`) returns an Elysia `beforeHandle` hook you can use with `.guard()` to scope payment to specific routes.

```ts [server.ts]
import { Elysia } from 'elysia'
import { Mppx, tempo } from 'mppx/elysia'

const mppx = Mppx.create({ methods: [tempo()] })

const app = new Elysia()
  .guard(
    { beforeHandle: mppx.charge({ amount: '1' }) },
    (app) => app.get('/premium', () => ({ data: 'paid content' })),
  )
```

### Global application

Use `.onBeforeHandle()` to apply payment to all routes.

```ts [server.ts]
import { Elysia } from 'elysia'
import { Mppx, tempo } from 'mppx/elysia'

const mppx = Mppx.create({ methods: [tempo()] }) // [!code hl]

const app = new Elysia()
  .onBeforeHandle(mppx.charge({ amount: '1' })) // [!code hl]
  .get('/premium', () => ({ data: 'paid content' }))
  .get('/another', () => ({ data: 'also paid' }))
```

### Session payments

Use `mppx.session()` to gate routes behind session-based payment intents.

```ts [server.ts]
import { Elysia } from 'elysia'
import { Mppx, tempo } from 'mppx/elysia'

const mppx = Mppx.create({ methods: [tempo()] })

const app = new Elysia()
  .guard(
    { beforeHandle: mppx.session({ amount: '1', unitType: 'token' }) },
    (app) => app.get('/content', () => ({ data: 'session content' })),
  )
```

# Express \[Payment middleware for Express]

Native [Express](https://expressjs.com) middleware that gates routes behind payment intents.

## Install

:::code-group

```bash [npm]
npm install mppx express
```

```bash [pnpm]
pnpm add mppx express
```

```bash [bun]
bun add mppx express
```

:::

## Usage

Import `Mppx` and `tempo` from `mppx/express` to create an Express-aware payment handler. Each intent (for example, `charge`) returns an Express `RequestHandler` you can slot directly into your route.

```ts [server.ts]
import express from 'express'
import { Mppx, tempo } from 'mppx/express'

const app = express()
const mppx = Mppx.create({ methods: [tempo()] }) // [!code hl]

app.get(
  '/premium', 
  mppx.charge({ amount: '1' }), // [!code hl]
  (req, res) => res.json({ data: 'paid content' }),
)
```

### Session payments

Use `mppx.session()` to gate routes behind session-based payment intents.

```ts [server.ts]
import express from 'express'
import { Mppx, tempo } from 'mppx/express'

const app = express()
const mppx = Mppx.create({ methods: [tempo()] })

app.get(
  '/content',
  mppx.session({ amount: '1', unitType: 'token' }),
  (req, res) => res.json({ data: 'session content' }),
)
```

# Hono \[Payment middleware for Hono]

Native [Hono](https://hono.dev) middleware that gates routes behind payment intents.

## Install

:::code-group

```bash [npm]
npm install mppx hono
```

```bash [pnpm]
pnpm add mppx hono
```

```bash [bun]
bun add mppx hono
```

:::

## Usage

Import `Mppx` and `tempo` from `mppx/hono` to create a Hono-aware payment handler. Each intent (for example, `charge`) returns a Hono `MiddlewareHandler` you can slot directly into your route.

```ts [server.ts]
import { Hono } from 'hono'
import { Mppx, tempo } from 'mppx/hono'

const app = new Hono()
const mppx = Mppx.create({ methods: [tempo()] }) // [!code hl]

app.get(
  '/premium', 
  mppx.charge({ amount: '1' }), // [!code hl]
  (c) => c.json({ data: 'paid content' }),
)
```

### Session payments

Use `mppx.session()` to gate routes behind session-based payment intents.

```ts [server.ts]
import { Hono } from 'hono'
import { Mppx, tempo } from 'mppx/hono'

const app = new Hono()
const mppx = Mppx.create({ methods: [tempo()] })

app.get(
  '/content',
  mppx.session({ amount: '1', unitType: 'token' }),
  (c) => c.json({ data: 'session content' }),
)
```

# Next.js \[Payment middleware for Next.js]

Native [Next.js](https://nextjs.org) route handler wrapper that gates routes behind payment intents.

## Install

:::code-group

```bash [npm]
npm install mppx
```

```bash [pnpm]
pnpm add mppx
```

```bash [bun]
bun add mppx
```

:::

## Usage

Import `Mppx` and `tempo` from `mppx/nextjs` to create a Next.js-aware payment handler. Each intent (for example, `charge`) returns a wrapper that accepts a route handler.

```ts [app/api/premium/route.ts]
import { Mppx, tempo } from 'mppx/nextjs'

const mppx = Mppx.create({ methods: [tempo()] }) // [!code hl]

export const GET = 
  mppx.charge({ amount: '1' }) // [!code hl]
  (() => Response.json({ data: 'paid content' }))
```

### Session payments

Use `mppx.session()` to gate routes behind session-based payment intents.

```ts [app/api/content/route.ts]
import { Mppx, tempo } from 'mppx/nextjs'

const mppx = Mppx.create({ methods: [tempo()] })

export const GET =
  mppx.session({ amount: '1', unitType: 'token' })
  (() => Response.json({ data: 'session content' }))
```

# `Method.tempo.charge`

The `charge` intent for the Tempo payment method. Requests a one-time payment from the client.

## Usage

```ts twoslash
import { Mppx, tempo } from 'mppx/server'

const mppx = Mppx.create({ methods: [tempo.charge()] })

export async function handler(request: Request) {
  // [!code focus:start]
  const response = await mppx.charge({
    amount: '0.1',
    currency: '0x20c0000000000000000000000000000000000000',
    recipient: '0xa726a1CD723409074DF9108A2187cfA19899aCF8',
  })(request)
  // [!code focus:end]

  if (response.status === 402) return response.challenge
  return response.withReceipt(Response.json({ data: '...' }))
}
```

### With expiry

Set a custom expiration time for the charge using the `expires` option.

```ts twoslash
import { Mppx, tempo } from 'mppx/server'

const mppx = Mppx.create({ methods: [tempo.charge()] })
// ---cut---
import { Expires } from 'mppx'

export async function handler(request: Request) {
  const response = await mppx.charge({
    amount: '0.1',
    currency: '0x20c0000000000000000000000000000000000000',
    expires: Expires.minutes(10), // [!code focus]
    recipient: '0xa726a1CD723409074DF9108A2187cfA19899aCF8',
  })(request)

  if (response.status === 402) return response.challenge
  return response.withReceipt(Response.json({ data: '...' }))
}
```

### With description

Add a human-readable description for the payment request.

```ts twoslash
import { Mppx, tempo } from 'mppx/server'

const mppx = Mppx.create({ methods: [tempo.charge()] })
// ---cut---
export async function handler(request: Request) {
  const response = await mppx.charge({
    amount: '0.1',
    currency: '0x20c0000000000000000000000000000000000000',
    description: 'API access for /resource', // [!code focus]
    recipient: '0xa726a1CD723409074DF9108A2187cfA19899aCF8',
  })(request)

  if (response.status === 402) return response.challenge
  return response.withReceipt(Response.json({ data: '...' }))
}
```

## Return type

Returns a function that accepts a `Request` and returns a response object with payment status.

```ts
type ReturnType = (request: Request) => Promise<
  | { status: 402; challenge: Response }
  | { status: 200; withReceipt: <T>(response: T) => T }
>
```

## Configuration

These parameters configure the `tempo.charge()` constructor.

### decimals (optional)

* **Type:** `number`
* **Default:** `6`

Decimal places for amount parsing.

### externalId (optional)

* **Type:** `string`

External identifier for the payment.

### feePayer (optional)

* **Type:** `Account`

Account for sponsoring transaction fees.

### getClient (optional)

* **Type:** `(parameters: { chainId?: number }) => MaybePromise<Client>`

Function that returns a viem client for the given chain ID. Overrides the default RPC configuration.

### memo (optional)

* **Type:** `string`

On-chain memo for the transaction.

### testnet (optional)

* **Type:** `boolean`

Testnet mode. Defaults the chain ID to `42431` (Tempo testnet).

## Request parameters

### amount

* **Type:** `string`

Payment amount in human-readable units. For example, `'0.1'` represents $0.10 USD.

### currency

* **Type:** `string`

TIP-20 token address for the payment currency.

### description (optional)

* **Type:** `string`

Human-readable description of the payment request.

### expires (optional)

* **Type:** `string`
* **Default:** 5 minutes from now

ISO 8601 timestamp for when the payment challenge expires.

### meta (optional)

* **Type:** `Record<string, string>`

Server-defined correlation data, serialized as `opaque` on the Challenge.

### recipient

* **Type:** `string`

Address to receive the payment.

# `Method.tempo.session` \[Low-cost high-throughput payments]

Creates a Tempo payment session method for server-side voucher verification and channel management.

## Usage

```ts twoslash
import { Mppx, tempo } from 'mppx/server'

const mppx = Mppx.create({
  // [!code focus:start]
  methods: [
    tempo.session({
      currency: '0x20c0000000000000000000000000000000000000',
      recipient: '0xa726a1CD723409074DF9108A2187cfA19899aCF8',
    }),
  ],
  // [!code focus:end]
})
```

### With charge and session

Register both intents on a single server.

```ts twoslash
import { Mppx, tempo } from 'mppx/server'

const mppx = Mppx.create({
  methods: [
    tempo.charge(),
    tempo.session(),
  ],
})
```

## Return type

```ts
import type { Method } from 'mppx'

type ReturnType = Method.Server
```

## Parameters

### account (optional)

* **Type:** `Account | undefined`

Account used as the recipient and for session closure.

### amount (optional)

* **Type:** `string`

Default amount to charge per unit.

### currency (optional)

* **Type:** `Address`

Default TIP-20 token address for the payment currency.

### decimals (optional)

* **Type:** `number`
* **Default:** `6`

Decimal places for amount parsing.

### escrowContract (optional)

* **Type:** `Address`

Escrow contract address for the payment channel. Defaults to the canonical escrow contract for the given chain ID.

### feePayer (optional)

* **Type:** `Account`

Account for sponsoring open and top-up transaction fees.

### getClient (optional)

* **Type:** `(parameters: { chainId: number }) => MaybePromise<Client>`

Function that returns a viem client for the given chain ID.

### minVoucherDelta (optional)

* **Type:** `string`
* **Default:** `"0"`

Minimum voucher delta to accept as a numeric string. Rejects vouchers where the increment over the previous highest voucher is below this threshold.

### recipient (optional)

* **Type:** `Address`

Default recipient address for payments.

### sse (optional)

* **Type:** `boolean | { poll?: boolean; pollingInterval?: number }`

Enable SSE streaming. Pass `true` to enable with defaults, or an options object to configure SSE (for example, `{ poll: true }` for Cloudflare Workers compatibility).

### store (optional)

* **Type:** `Store`
* **Default:** `Store.memory()`

Storage backend for persisting channel and session state. Implements atomic read-modify-write operations for concurrency safety.

```ts twoslash
import { Store, tempo } from 'mppx/server'

const method = tempo.session({
  store: Store.memory(), // [!code focus]
})
```

### suggestedDeposit (optional)

* **Type:** `string`

Suggested deposit amount communicated to clients in the challenge.

### testnet (optional)

* **Type:** `boolean`

Testnet mode.

### unitType (optional)

* **Type:** `string`

Unit type label (for example, "token", "byte", "request").

# `Mppx.create`

Creates a server-side payment handler from a method.

## Usage

```ts twoslash
import { Mppx, tempo } from 'mppx/server'

const payment = Mppx.create({
  methods: [tempo()],
})
```

### With custom transport

Use a custom transport for non-HTTP environments like MCP servers.

```ts twoslash
import { Mppx, tempo, Transport } from 'mppx/server'

const payment = Mppx.create({
  methods: [tempo()],
  transport: Transport.mcpSdk(),
})
```

## Return type

```ts
import type { Method } from 'mppx'
import type { Mppx, Transport } from 'mppx/server'

type ReturnType = Mppx<[Method.Server], Transport.Http>
```

The returned object includes the method's intent functions (for example, `charge`) which you call to handle payment requests.

## Parameters

### methods

* **Type:** `readonly Method.Server[]`

Array of payment methods (for example, `[tempo()]`).

```ts twoslash
import { Mppx, tempo } from 'mppx/server'

const payment = Mppx.create({
  // [!code focus:start]
  methods: [tempo()],
  // [!code focus:end]
})
```

### realm (optional)

* **Type:** `string`
* **Default:** Auto-detected from environment variables (`MPP_REALM`, `FLY_APP_NAME`, `HEROKU_APP_NAME`, `HOST`, `HOSTNAME`, `RAILWAY_PUBLIC_DOMAIN`, `RENDER_EXTERNAL_HOSTNAME`, `VERCEL_URL`, `WEBSITE_HOSTNAME`), falling back to `"MPP Payment"`.

Server realm (for example, hostname). Auto-detected from common platform environment variables. Set explicitly to override.

```ts twoslash
import { Mppx, tempo } from 'mppx/server'

const payment = Mppx.create({
  methods: [tempo()],
  realm: 'mpp.dev', // [!code focus]
})
```

### secretKey (optional)

* **Type:** `string`
* **Default:** Auto-detected from `MPP_SECRET_KEY` environment variable, falling back to a random key.

Secret key for HMAC-bound challenge IDs. Enables stateless verification—the server verifies that a Challenge was issued by itself without storing state.

```ts twoslash
import { Mppx, tempo } from 'mppx/server'

const payment = Mppx.create({
  methods: [tempo()],
  secretKey: process.env.MPPX_SECRET_KEY!, // [!code focus]
})
```

### transport (optional)

* **Type:** `Transport`
* **Default:** `Transport.http()`

Transport to use for handling payment requests.

```ts twoslash
import { Mppx, tempo, Transport } from 'mppx/server'

const payment = Mppx.create({
  methods: [tempo()],
  transport: Transport.mcp(), // [!code focus]
})
```

# `Mppx.toNodeListener`

Wraps a payment handler to create a Node.js HTTP listener.

## Usage

```ts twoslash
import * as http from 'node:http'
import { Mppx, tempo } from 'mppx/server'

const mppx = Mppx.create({
  methods: [tempo()],
})

http.createServer(async (req, res) => {
  const result = await Mppx.toNodeListener(
    mppx.charge({
      amount: '0.1', 
      currency: '0x...', 
      recipient: '0x...',
    }),
  )(req, res)

  if (result.status === 402) return

  res.end('OK')
})
```

## Behavior

* **On `402`:** Writes the challenge response headers and body, then ends the connection.
* **On `200`:** Sets the `Payment-Receipt` header; the caller writes the response body.

## Return type

```ts
type ReturnType = (
  req: IncomingMessage,
  res: ServerResponse,
) => Promise<MethodFn.Response<Transport.Http>>
```

## Parameters

### handler

* **Type:** `(input: Request) => Promise<MethodFn.Response<Transport.Http>>`

The payment handler function returned by calling an intent on the payment object.

```ts twoslash
import * as http from 'node:http'
import { Mppx, tempo } from 'mppx/server'

const mppx = Mppx.create({
  methods: [tempo()],
})

http.createServer(async (req, res) => {
  const result = await Mppx.toNodeListener(
    // [!code focus:start]
    mppx.charge({
      amount: '0.1',
      currency: '0x...',
      recipient: '0x...',
    }),
    // [!code focus:end]
  )(req, res)

  if (result.status === 402) return
  res.end('OK')
})
```

# `Transport.from`

Creates a custom server-side transport.

## Usage

```ts twoslash
import { Challenge, Credential, Receipt } from 'mppx'
import { Transport } from 'mppx/server'

const http = Transport.from<Request, Response>({
  name: 'http',

  getCredential(request) {
    const header = request.headers.get('Authorization')
    if (!header) return null
    const payment = Credential.extractPaymentScheme(header)
    if (!payment) return null
    return Credential.deserialize(payment)
  },

  respondChallenge({ challenge, error }) {
    const headers: Record<string, string> = {
      'WWW-Authenticate': Challenge.serialize(challenge),
      'Cache-Control': 'no-store',
    }

    let body: string | null = null
    if (error) {
      headers['Content-Type'] = 'application/problem+json'
      body = JSON.stringify(error.toProblemDetails(challenge.id))
    }

    return new Response(body, { status: 402, headers })
  },

  respondReceipt({ receipt, response }) {
    const headers = new Headers(response.headers)
    headers.set('Payment-Receipt', Receipt.serialize(receipt))
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    })
  },
})
```

## Return type

```ts
type ReturnType = Transport<Input, ChallengeOutput, ReceiptOutput>
```

## Parameters

### getCredential

* **Type:** `(input: Input) => Credential | null`

Extracts credential from the transport input. Returns `null` if no credential was provided, or throws if malformed.

### name

* **Type:** `string`

Transport name for identification.

### respondChallenge

* **Type:** `(options: { challenge: Challenge; error?: PaymentError; input: Input }) => ChallengeOutput | Promise<ChallengeOutput>`

Creates a transport response for a payment challenge.

### respondReceipt

* **Type:** `(options: { challengeId: string; receipt: Receipt; response: ReceiptOutput }) => ReceiptOutput`

Attaches a receipt to a successful response.

# `Transport.http`

HTTP transport for server-side payment handling.

## Usage

```ts twoslash
import { Mppx, tempo, Transport } from 'mppx/server'

const mppx = Mppx.create({
  methods: [tempo()],
  transport: Transport.http(),
})
```

## Behavior

* Reads credentials from the `Authorization` header
* Issues challenges in the `WWW-Authenticate` header with `402` status
* Attaches receipts in the `Payment-Receipt` header

## Return type

```ts
type ReturnType = Transport<Request, Response>
```

# `Transport.mcp`

MCP transport for server-side payment handling with raw JSON-RPC.

## Usage

```ts twoslash
import { Mppx, tempo, Transport } from 'mppx/server'

const mppx = Mppx.create({
  methods: [tempo()],
  transport: Transport.mcp(),
})
```

## Behavior

* Reads credentials from `_meta["org.paymentauth/credential"]`
* Issues challenges in a JSON-RPC error with code `-32042`/`-32043`
* Attaches receipts in `_meta["org.paymentauth/receipt"]`

Use this transport when handling raw JSON-RPC messages directly. For use with [`@modelcontextprotocol/sdk`](https://github.com/modelcontextprotocol/typescript-sdk), use [`Transport.mcpSdk()`](/sdk/typescript/server/Transport.mcpSdk) instead.

## Return type

```ts
import type { Mcp } from 'mppx'

type ReturnType = Transport<Mcp.JsonRpcRequest, Mcp.Response>
```

# `Transport.mcpSdk`

MCP SDK transport for server-side payment handling with [`@modelcontextprotocol/sdk`](https://github.com/modelcontextprotocol/typescript-sdk).

## Usage

```ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp'
import { Mppx, tempo, Transport } from 'mppx/server'

const mppx = Mppx.create({
  methods: [tempo()],
  transport: Transport.mcpSdk(),
})

const server = new McpServer({ name: 'example', version: '1.0.0' })

server.registerTool('premium', { description: 'A premium tool' }, async (extra) => {
  const result = await mppx.charge({
    amount: '0.1', currency: '0x...', recipient: '0x...',
  })(extra)

  if (result.status === 402) throw result.challenge

  return result.withReceipt({ content: [{ type: 'text', text: 'Success!' }] })
})
```

## Behavior

* Reads credentials from `_meta["org.paymentauth/credential"]`
* Issues challenges as `McpError` with code `-32042` and challenge in `error.data`
* Attaches receipts in `_meta["org.paymentauth/receipt"]` on tool results

## Return type

```ts
import type { CallToolResult, McpError } from '@modelcontextprotocol/sdk/types.js'

type ReturnType = Transport<Extra, McpError, CallToolResult>
```

Where `Extra` is the MCP SDK tool handler "extra" parameter compatible with [`@modelcontextprotocol/sdk`](https://github.com/modelcontextprotocol/typescript-sdk) `RequestHandlerExtra`.
