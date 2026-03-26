# MPP — Machine Payments Protocol

MPP (Machine Payments Protocol) is the open standard for machine-to-machine payments via HTTP 402.

<!--
Sitemap:
- [MPP — Machine Payments Protocol](/index): MPP (Machine Payments Protocol) is the open standard for machine-to-machine payments—co-developed by Tempo and Stripe. Charge for API requests, tool calls, and content via HTTP 402.
- [Page Not Found](/404)
- [Brand assets and guidelines](/brand): Download official MPP logos, wordmarks, and brand assets. Guidelines for using the Machine Payments Protocol brand in your project or integration.
- [Extensions](/extensions): Community-built tools and integrations for MPP
- [Frequently asked questions](/faq): Answers to common questions about MPP—payment methods, settlement, pricing, security, and how the protocol compares to API keys and subscriptions.
- [Machine Payments Protocol](/overview): MPP standardizes HTTP 402 for machine-to-machine payments. Learn how agents, apps, and services exchange payments in the same HTTP request.
- [Payment methods](/payment-methods/): Available methods and how to choose one
- [Protocol overview](/protocol/): The Machine Payments Protocol standardizes HTTP 402 with an extensible challenge–credential–receipt flow that works with any payment network.
- [Quickstart](/quickstart/): Get started with MPP in minutes. Protect your API with payments, connect your agent, or integrate your app with MPP-enabled services.
- [SDKs and client libraries](/sdk/): Official MPP SDK implementations in TypeScript, Python, and Rust. Libraries for building MPP clients and servers with full protocol support.
- [Build with an LLM](/guides/building-with-an-llm): Use llms-full.txt to give your agent complete MPP context.
- [Accept multiple payment methods](/guides/multiple-payment-methods): Accept Tempo stablecoins, Stripe cards, and Lightning Bitcoin on a single API endpoint. Serve a multi-method 402 Challenge and let clients choose.
- [Accept one-time payments](/guides/one-time-payments): Charge per request with a payment-gated API
- [Accept pay-as-you-go payments](/guides/pay-as-you-go): Build a payment-gated API with session-based billing using mppx payment channels. Charge per request with near-zero latency overhead.
- [Accept streamed payments](/guides/streamed-payments): Accept streamed payments over Server-Sent Events with mppx. Bill per token in real time using Tempo payment channels for LLM inference APIs.
- [Charge intent for one-time payments](/intents/charge): Immediate one-time payments
- [Card payment method](/payment-methods/card/): Card payments via encrypted network tokens
- [Custom payment methods](/payment-methods/custom): Build your own payment method
- [Lightning](/payment-methods/lightning/): Bitcoin payments over the Lightning Network
- [Solana](/payment-methods/solana/): Native SOL and SPL token payments
- [Stripe payment method](/payment-methods/stripe/): Cards, wallets, and other Stripe supported payment methods
- [Tempo stablecoin payments](/payment-methods/tempo/): Stablecoin payments on the Tempo blockchain
- [Challenges](/protocol/challenges): Server-issued payment requirements
- [Credentials](/protocol/credentials): Client-submitted payment proofs
- [Discovery](/protocol/discovery): Advertise your API's payment terms with an OpenAPI discovery document so clients and agents know what endpoints cost before making requests.
- [HTTP 402 payment required](/protocol/http-402): HTTP 402 Payment Required signals that a resource requires payment. Learn when and how MPP servers return 402 with a WWW-Authenticate Challenge.
- [Payment receipts and verification](/protocol/receipts): Receipts confirm successful payment in MPP. Return them in the Payment-Receipt header so clients can verify that the server accepted their Credential.
- [Transports](/protocol/transports/): MPP defines transport bindings for HTTP and MCP. Learn how Challenges, Credentials, and Receipts map to headers and JSON-RPC messages.
- [Use with agents](/quickstart/agent): Connect your coding agent to MPP-enabled services. Set up Tempo Wallet or the mppx SDK to handle 402 payment flows automatically.
- [Use with your app](/quickstart/client): Handle payment-gated resources in your app. Use the mppx client SDK to intercept 402 responses, pay, and retry—all automatically.
- [Add payments to your API](/quickstart/server): Add payment-gated access to your API with mppx. Accept stablecoins, cards, and Bitcoin in a few lines of code using the MPP server SDK.
- [SDK features](/sdk/features): Feature parity across TypeScript, Python, and Rust MPP SDKs.
- [Python SDK](/sdk/python/): The pympp Python library
- [Rust SDK for MPP](/sdk/rust/): The mpp Rust library
- [Getting started](/sdk/typescript/): The mppx TypeScript library
- [Card charge](/payment-methods/card/charge): One-time payments using encrypted network tokens
- [Lightning charge](/payment-methods/lightning/charge): One-time payments using BOLT11 invoices
- [Lightning session](/payment-methods/lightning/session): Pay-as-you-go payments over Lightning
- [Solana charge](/payment-methods/solana/charge): One-time payments on Solana
- [Stripe charge](/payment-methods/stripe/charge): One-time payments using Shared Payment Tokens
- [Tempo charge](/payment-methods/tempo/charge): One-time TIP-20 token transfers
- [Session](/payment-methods/tempo/session): Low-cost high-throughput payments
- [HTTP transport](/protocol/transports/http): The HTTP transport maps MPP payment flows to standard HTTP headers—WWW-Authenticate for Challenges, Authorization for Credentials, and Payment-Receipt.
- [MCP and JSON-RPC transport](/protocol/transports/mcp): Payment flows for AI tool calls
- [Python MPP client](/sdk/python/client): Handle 402 responses automatically
- [Core Types](/sdk/python/core): Challenge, Credential, and Receipt primitives
- [Server](/sdk/python/server): Protect endpoints with payment requirements
- [Client](/sdk/rust/client): Handle 402 responses automatically
- [Core types](/sdk/rust/core): Challenge, Credential, and Receipt primitives
- [Server](/sdk/rust/server): Protect endpoints with payment requirements
- [CLI Reference](/sdk/typescript/cli): Built-in command-line tool for paid HTTP requests
- [Method.from](/sdk/typescript/Method.from): Create a payment method from a definition
- [Paid API proxy server](/sdk/typescript/proxy): Paid API proxy
- [McpClient.wrap](/sdk/typescript/client/McpClient.wrap): Payment-aware MCP client
- [stripe client method](/sdk/typescript/client/Method.stripe): Register all Stripe intents
- [Method.stripe.charge](/sdk/typescript/client/Method.stripe.charge): One-time payments via Shared Payment Tokens
- [tempo client method](/sdk/typescript/client/Method.tempo): Register all Tempo intents
- [Method.tempo.charge](/sdk/typescript/client/Method.tempo.charge): One-time payments
- [Method.tempo.session](/sdk/typescript/client/Method.tempo.session): Low-cost high-throughput payments
- [tempo.session](/sdk/typescript/client/Method.tempo.session-manager): Standalone session manager
- [Mppx.create](/sdk/typescript/client/Mppx.create): Create a payment-aware fetch client
- [Mppx.restore](/sdk/typescript/client/Mppx.restore): Restore the original global fetch
- [Transport.from](/sdk/typescript/client/Transport.from): Create a custom transport
- [Transport.http](/sdk/typescript/client/Transport.http): HTTP transport for payments
- [Transport.mcp](/sdk/typescript/client/Transport.mcp): MCP transport for payments
- [BodyDigest.compute](/sdk/typescript/core/BodyDigest.compute): Compute a body digest hash
- [BodyDigest.verify](/sdk/typescript/core/BodyDigest.verify): Verify a body digest hash
- [Challenge.deserialize](/sdk/typescript/core/Challenge.deserialize): Deserialize a Challenge from a header
- [Challenge.from](/sdk/typescript/core/Challenge.from): Create a new Challenge
- [Challenge.fromHeaders](/sdk/typescript/core/Challenge.fromHeaders): Extract a Challenge from Headers
- [Challenge.fromMethod](/sdk/typescript/core/Challenge.fromMethod): Create a Challenge from a method
- [Challenge.fromResponse](/sdk/typescript/core/Challenge.fromResponse): Extract a Challenge from a Response
- [Challenge.meta](/sdk/typescript/core/Challenge.meta): Extract correlation data from a Challenge
- [Challenge.serialize](/sdk/typescript/core/Challenge.serialize): Serialize a Challenge to a header
- [Challenge.verify](/sdk/typescript/core/Challenge.verify): Verify a Challenge HMAC
- [Credential.deserialize](/sdk/typescript/core/Credential.deserialize): Deserialize a Credential from a header
- [Credential.from](/sdk/typescript/core/Credential.from): Create a new Credential
- [Credential.fromRequest](/sdk/typescript/core/Credential.fromRequest): Extract a Credential from a Request
- [Credential.serialize](/sdk/typescript/core/Credential.serialize): Serialize a Credential to a header
- [Expires utility functions](/sdk/typescript/core/Expires): Generate relative expiration timestamps
- [Method.from](/sdk/typescript/core/Method.from): Create a payment method definition
- [Method.toClient](/sdk/typescript/core/Method.toClient): Extend a method with client logic
- [Method.toServer](/sdk/typescript/core/Method.toServer): Extend a method with server verification
- [PaymentRequest.deserialize](/sdk/typescript/core/PaymentRequest.deserialize): Deserialize a payment request
- [PaymentRequest.from](/sdk/typescript/core/PaymentRequest.from): Create a payment request
- [PaymentRequest.serialize](/sdk/typescript/core/PaymentRequest.serialize): Serialize a payment request to a string
- [Receipt.deserialize](/sdk/typescript/core/Receipt.deserialize): Deserialize a Receipt from a header
- [Receipt.from](/sdk/typescript/core/Receipt.from): Create a new Receipt
- [Receipt.fromResponse](/sdk/typescript/core/Receipt.fromResponse): Extract a Receipt from a Response
- [Receipt.serialize](/sdk/typescript/core/Receipt.serialize): Serialize a Receipt to a string
- [Elysia payment middleware](/sdk/typescript/middlewares/elysia): Payment middleware for Elysia
- [Express payment middleware](/sdk/typescript/middlewares/express): Payment middleware for Express
- [Hono payment middleware](/sdk/typescript/middlewares/hono): Payment middleware for Hono
- [Next.js payment middleware](/sdk/typescript/middlewares/nextjs): Payment middleware for Next.js
- [stripe](/sdk/typescript/server/Method.stripe): Register all Stripe intents
- [Method.stripe.charge](/sdk/typescript/server/Method.stripe.charge): One-time payments via Shared Payment Tokens
- [tempo server method](/sdk/typescript/server/Method.tempo): Register all Tempo intents
- [Method.tempo.charge](/sdk/typescript/server/Method.tempo.charge): One-time stablecoin payments
- [Method.tempo.session](/sdk/typescript/server/Method.tempo.session): Low-cost high-throughput payments
- [Mppx.compose](/sdk/typescript/server/Mppx.compose): Present multiple payment options
- [Mppx.create](/sdk/typescript/server/Mppx.create): Create a server-side payment handler
- [Mppx.toNodeListener](/sdk/typescript/server/Mppx.toNodeListener): Adapt payments for Node.js HTTP
- [Request.toNodeListener](/sdk/typescript/server/Request.toNodeListener): Convert Fetch handlers to Node.js
- [Response.requirePayment](/sdk/typescript/server/Response.requirePayment): Create a 402 response
- [Transport.from](/sdk/typescript/server/Transport.from): Create a custom transport
- [Transport.http](/sdk/typescript/server/Transport.http): HTTP server-side transport
- [Transport.mcp](/sdk/typescript/server/Transport.mcp): Raw JSON-RPC MCP transport
- [Transport.mcpSdk](/sdk/typescript/server/Transport.mcpSdk): MCP SDK server-side transport
-->

<h1 style={{ position: 'absolute', width: '1px', height: '1px', padding: 0, margin: '-1px', overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 }}>MPP — Machine Payments Protocol</h1>

<LandingPage />

<NotFoundPage />

# Brand \[MPP brand assets and guidelines]

<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", border: "1px solid var(--vocs-border-color-primary)", padding: "1.5rem", borderRadius: "8px", backgroundColor: "var(--vocs-background-color-primary)" }}>
  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
    <span style={{ fontSize: "18px", color: "var(--vocs-text-color-heading)" }}>
      Get brand assets
    </span>

    <span style={{ fontSize: "14px", color: "var(--vocs-text-color-secondary)" }}>
      Download MPP logos and icons for use in your context.
    </span>
  </div>

  <a
    href="/brand.zip"
    download
    style={{
  display: "inline-flex",
  alignItems: "center",
  gap: "0.5rem",
  padding: "0.5rem 1rem",
  borderRadius: "8px",
  border: "1px solid var(--vocs-border-color-primary)",
  backgroundColor: "var(--vocs-background-color-)",
  fontSize: "14px",
  fontWeight: 500,
  color: "var(--vocs-text-color-heading)",
  textDecoration: "none",
}}
  >
    Download (.zip)
  </a>
</div>

## Logo

<div
  style={{
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: "2rem",
}}
>
  <span style={{ color: "var(--vocs-text-color-secondary)", fontSize: "14px" }}>
    The full MPP logo for headers, documentation, and marketing materials.
  </span>

  <DownloadSvgButton files={["/logo-dark.svg", "/logo-light.svg"]} />
</div>

<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem" }}>
  <div
    style={{
    padding: "2.5rem 2rem",
    backgroundColor: "#ffffff",
    borderRadius: "8px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    border: "4px solid var(--vocs-background-color-surface)",
    boxShadow: "inset 0 0 0 1px var(--vocs-border-color-primary)",
  }}
  >
    <span
      style={{
      position: "absolute",
      top: "0.6rem",
      right: "2rem",
      fontSize: "10px",
      fontFamily: "var(--font-mono)",
      color: "#999",
      letterSpacing: "0.04em",
    }}
    >
      LIGHT
    </span>

    <img src="/logo-dark.svg" alt="MPP Logo (dark, for light backgrounds)" style={{ maxWidth: "150px", width: "100%" }} />
  </div>

  <div
    style={{
    padding: "2.5rem 2rem",
    borderRadius: "8px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    border: "1px solid rgba(255,255,255,0.08)",
    backgroundColor: "#141414",
  }}
  >
    <span
      style={{
      position: "absolute",
      top: "0.6rem",
      right: "2rem",
      fontSize: "10px",
      fontFamily: "var(--font-mono)",
      color: "#666",
      letterSpacing: "0.04em",
    }}
    >
      DARK
    </span>

    <img src="/logo-light.svg" alt="MPP Logo (light, for dark backgrounds)" style={{ maxWidth: "150px", width: "100%" }} />
  </div>
</div>

## Lockup

<div
  style={{
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: "2rem",
}}
>
  <span style={{ color: "var(--vocs-text-color-secondary)", fontSize: "14px" }}>
    The "Machine Payments Protocol" wordmark for landing pages and hero
    sections.
  </span>

  <DownloadSvgButton files={["/lockup-dark.svg", "/lockup-light.svg"]} />
</div>

<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem" }}>
  <div
    style={{
    padding: "2.5rem 2rem",
    backgroundColor: "#ffffff",
    borderRadius: "8px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    border: "4px solid var(--vocs-background-color-surface)",
    boxShadow: "inset 0 0 0 1px var(--vocs-border-color-primary)",
  }}
  >
    <span
      style={{
      position: "absolute",
      top: "0.6rem",
      right: "2rem",
      fontSize: "10px",
      fontFamily: "var(--font-mono)",
      color: "#999",
      letterSpacing: "0.04em",
    }}
    >
      LIGHT
    </span>

    <img src="/lockup-dark.svg" alt="MPP Lockup (for light backgrounds)" style={{ maxWidth: "clamp(280px, 80vw, 420px)", width: "100%" }} />
  </div>

  <div
    style={{
    padding: "2.5rem 2rem",
    borderRadius: "8px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    border: "1px solid rgba(255,255,255,0.08)",
    backgroundColor: "#141414",
  }}
  >
    <span
      style={{
      position: "absolute",
      top: "0.6rem",
      right: "2rem",
      fontSize: "10px",
      fontFamily: "var(--font-mono)",
      color: "#666",
      letterSpacing: "0.04em",
    }}
    >
      DARK
    </span>

    <img src="/lockup-light.svg" alt="MPP Lockup (for dark backgrounds)" style={{ maxWidth: "clamp(280px, 80vw, 420px)", width: "100%" }} />
  </div>
</div>

## Icon

<div
  style={{
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: "2rem",
}}
>
  <span style={{ color: "var(--vocs-text-color-secondary)", fontSize: "14px" }}>
    The square MPP icon for favicons, app icons, and compact spaces.
  </span>

  <DownloadSvgButton files={["/favicon.svg", "/favicon-dark.svg"]} />
</div>

<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem" }}>
  <div
    style={{
    padding: "2.5rem 2rem",
    backgroundColor: "#ffffff",
    borderRadius: "8px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    border: "4px solid var(--vocs-background-color-surface)",
    boxShadow: "inset 0 0 0 1px var(--vocs-border-color-primary)",
  }}
  >
    <span
      style={{
      position: "absolute",
      top: "0.6rem",
      right: "2rem",
      fontSize: "10px",
      fontFamily: "var(--font-mono)",
      color: "#999",
      letterSpacing: "0.04em",
    }}
    >
      LIGHT
    </span>

    <img src="/favicon.svg" alt="MPP Icon (dark, for light backgrounds)" style={{ width: "120px", height: "120px" }} />
  </div>

  <div
    style={{
    padding: "2.5rem 2rem",
    borderRadius: "8px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    border: "1px solid rgba(255,255,255,0.08)",
    backgroundColor: "#141414",
  }}
  >
    <span
      style={{
      position: "absolute",
      top: "0.6rem",
      right: "2rem",
      fontSize: "10px",
      fontFamily: "var(--font-mono)",
      color: "#666",
      letterSpacing: "0.04em",
    }}
    >
      DARK
    </span>

    <img src="/favicon-dark.svg" alt="MPP Icon (light, for dark backgrounds)" style={{ width: "120px", height: "120px" }} />
  </div>
</div>

## ASCII art

<div
  style={{
  padding: "2rem",
  backgroundColor: "var(--vocs-background-color-primary)",
  borderRadius: "8px",
  overflow: "auto",
  color: "var(--vocs-text-color-heading)",
  display: "flex",
  justifyContent: "center",
  border: "1px solid var(--vocs-border-color-primary)",
}}
>
  <AsciiLogo />
</div>

## Usage guidelines

* Use the logo on light backgrounds with the dark variant, and on dark backgrounds with the light variant
* Maintain adequate spacing around the logo
* Do not distort, rotate, or alter the logo colors
* Use the square icon for favicons and app icons where the full logo does not fit

# Extensions \[Community-built tools and integrations for MPP]

Third-party packages that extend MPP with new payment methods, middleware, and utilities.

| Name | Description | Link |
|---|---|---|
| `@insumermodel/mppx-token-gate` | Token-gate mppx routes—free access for NFT/token holders across 32 chains | [npm](https://www.npmjs.com/package/@insumermodel/mppx-token-gate) |

Want to build your own? See [Custom payment methods](/payment-methods/custom).

# Frequently asked questions \[Common questions about the Machine Payments Protocol]

## Is MPP only for stablecoins?

No. MPP is payment-method agnostic—the protocol works with any payment rail.

Today, [Tempo](/payment-methods/tempo) stablecoin payments, [Stripe](/payment-methods/stripe) (Visa, Mastercard, and other card networks), and [Lightning](/payment-methods/lightning) (Bitcoin over the Lightning Network) are in production. Anyone can build a [custom payment method](/payment-methods/custom) by implementing the core control flow for their payment rail. See the full list of payment methods and specifications at [paymentauth.org](https://paymentauth.org).

## Do I need a stablecoin wallet?

No. With Stripe, you can pay with cards without stablecoins. With Lightning, you can pay with Bitcoin.

For Tempo payments, you need a stablecoin wallet to sign transactions. The SDK and the `tempo wallet` CLI handle key management for you.

## How is MPP different from x402?

Both MPP and x402 use HTTP `402` to signal that a request requires payment. The key differences:

* **Payment-method agnostic.** MPP supports stablecoins, cards, wallets, and custom rails through extensible payment method specifications. x402 only supports blockchains.
* **Designed for production.** MPP supports idempotency, expiration, request-body binding (digest), and request-tampering mitigations as first-class primitives.
* **Performant payments.** MPP's session intent enables pay-as-you-go metering for payments as small as 0.0001 USD. Sessions achieve sub-100ms latency and near-zero per-request fees by settling off-chain vouchers, enabling high-throughput applications like token streaming or content aggregation. x402 requires an on-chain transaction per request.
* **Permissionless extensibility.** Anyone can author and publish a new payment method or intent specification without approval from a foundation or intermediary. Payment methods compete on adoption and are independently maintained.
* **IETF standards track.** The core [Payment HTTP Authentication Scheme](https://paymentauth.org) is submitted to the IETF for standardization.

## Is MPP compatible with x402?

Yes. The core x402 "exact" flows map directly onto MPP's charge intent. MPP clients can consume existing x402 services. MPP extends beyond x402 with idempotency, receipts, request binding, multiple payment methods including stablecoins and fiat, and efficient low-cost flows like sessions.

## Why build MPP on Tempo?

MPP works with any payment rail—Stripe for cards, Lightning for Bitcoin, or any custom method. You don't have to use Tempo.

That said, high-throughput, low-value transactions benefit from specific properties that Tempo provides:

* **Fast, deterministic finality**—Certainty that a payment has settled, not probabilistic confirmation.
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

## What happens if a payment fails?

The service returns an error with details following [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457) (Problem Details for HTTP APIs). Your client can retry with a different payment method or surface the error. No money is deducted for failed requests.

## Can I accept MPP payments for my own service?

Yes. See the [server quickstart](/quickstart/server) to start accepting payments in a few lines of code. The TypeScript SDK includes middleware for popular frameworks including Hono, Express, Next.js, and Elysia.

## Is MPP an IETF standard?

The core [Payment HTTP Authentication Scheme](https://datatracker.ietf.org/doc/draft-ryan-httpauth-payment/) is submitted to the IETF standards track. Payment method and intent specifications (for example, charge, session) are separate documents that anyone can author and publish independently—they do not require IETF approval. This mirrors how the web works: HTTP is standardized, but content types and authentication schemes evolve independently.

## Can I use MPP outside of HTTP?

Yes. MPP includes an [MCP transport binding](/protocol/transports/mcp) that maps the Challenge-Credential-Receipt flow onto the Model Context Protocol. This means MCP servers can monetize tool calls directly, and agents pay autonomously without OAuth or account setup.

## Who is building MPP?

MPP is co-authored by Tempo and Stripe. The core specification is developed in the open and designed to be extended by any payment network or provider. The [Payment HTTP Authentication Scheme](https://datatracker.ietf.org/doc/draft-ryan-httpauth-payment/) is submitted to the IETF.

# Machine Payments Protocol \[The open protocol for machine-to-machine payments]

The Machine Payments Protocol (MPP) lets any client—agents, apps, or humans—pay for any service in the same HTTP request. Developers use MPP to let their agents pay for services. Service operators use MPP to accept payments for their APIs.

MPP is built around a simple, extensible core and is neutral to the implementation of underlying payment flows and methods.

* **Open standard built for the internet**—Built on an [open specification proposed to the IETF](https://paymentauth.org), not a proprietary API
* **Designed for payments**—Idempotency, security, and receipts are first-class primitives
* **Works with stablecoins, cards, and bank transfers**—All payment methods can be supported through one protocol and flexible control flow
* **Any currency**—Transact in USD, EUR, BRL, USDC, BTC, or any other asset
* **Composable and designed for extension**—A flexible core allows advanced flows like disputes or additional primitives like identity to be gradually introduced

## Who is MPP for?

MPP involves three parties:

* **Developers** build apps and agents that consume paid services. You integrate an MPP client so your agent can discover, pay for, and use third-party APIs without manual signup or API keys.
* **Agents** are the entities that take action—calling APIs, generating images, querying data. They pay for services autonomously on behalf of your users.
* **Services** operate APIs that charge for access—LLM inference, image generation, web search, and more. You integrate an MPP server to accept payments with zero onboarding friction.

## The problem with payments on the internet

There is no shortage of ways to pay for things on the internet. Hundreds of payment methods give users ample space for personal preference, and optimized payment forms with one-click checkout ensure that the act of paying is low-friction and highly secure.

However, the very things that make these payment flows familiar and fast for human purchasers are structural headwinds for programmatic consumption. Many have tried, but it is a consistent uphill battle to fight browser automation pipelines, visual captchas, and ever changing payment forms—all of which reduce reliability, increase latency, and bear high costs.

This is not the fault of any individual payment method or credential. This is a global problem which exists at the *interface* level: how buyer and seller negotiate cost, supported payment methods, and ultimately transact.

The Machine Payments Protocol addresses this gap by providing a payment interface built for programmatic access that strips away the complexity of rich checkout flows, while still providing robust security and reliability. By using MPP, you can accept payments from any client—agents, apps, or humans—and across any payment method, without complex checkout flows and integrations.

## Try it out

See the full payment flow in action. The terminal creates an ephemeral wallet, funds it with testnet USDC, and makes a paid request.

<div style={{ height: 420 }}>
  <TerminalPing />
</div>

## Use cases

* **Pay for LLM usage**—Your agent calls LLM providers through MPP, paying per token over a Tempo session. No API key management needed.
* **Generate an image**—Request image generation from fal.ai, paying per request with a Tempo charge. The agent gets the result in the same response.
* **Search the web**—Query Parallel for real-time search results, paying per query over a Tempo session. Results flow back in the same HTTP response.
* **Accept payments for your API**—Accept payments from any client—agents, apps, or humans—without requiring signups, billing accounts, or API keys.

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

  <SpecCard to="https://paymentauth.org" />
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

  <Tab title="Card">
    ```http
    HTTP/1.1 402 Payment Required
    WWW-Authenticate: Payment method="card", intent="charge", ...
    ```
  </Tab>

  <Tab title="Lightning">
    ```http
    HTTP/1.1 402 Payment Required
    WWW-Authenticate: Payment method="lightning", intent="charge", ...
    ```
  </Tab>

  <Tab title="Solana">
    ```http
    HTTP/1.1 402 Payment Required
    WWW-Authenticate: Payment method="solana", intent="charge", ...
    ```
  </Tab>
</Tabs>

## Available methods

<Cards>
  <TempoMethodCard />

  <StripeMethodCard />

  <CardMethodCard />

  <LightningMethodCard />

  <SolanaMethodCard />

  <CustomMethodCard />
</Cards>

# Protocol overview \[Standardizing HTTP 402 for machine-to-machine payments]

The Machine Payments Protocol (MPP) is a protocol for machine-to-machine payments. It standardizes HTTP `402` "Payment Required" with an extensible framework that works with any payment network.

These docs provide a developer-friendly overview. For the full specification, see the full [IETF Specification](https://paymentauth.org).

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

| Condition                                          | Status                               | Response                                         |
| -------------------------------------------------- | ------------------------------------ | ------------------------------------------------ |
| Resource requires payment, no credential provided  | <Badge variant="danger">402</Badge>  | Fresh challenge in `WWW-Authenticate`            |
| Malformed credential (invalid base64url, bad JSON) | <Badge variant="danger">402</Badge>  | Fresh challenge + `malformed-credential` problem |
| Unknown, expired, or already-used challenge id     | <Badge variant="danger">402</Badge>  | Fresh challenge + `invalid-challenge` problem    |
| Payment proof invalid or verification failed       | <Badge variant="danger">402</Badge>  | Fresh challenge + `verification-failed` problem  |
| Payment verified, access granted                   | <Badge variant="success">200</Badge> | Resource + optional `Payment-Receipt`            |
| Payment verified, but policy denies access         | <Badge variant="warning">403</Badge> | No challenge (payment was valid)                 |

See [HTTP 402](/protocol/http-402) for details on when to return each status code.

## Payment method agnostic

MPP works with any payment network or currency. The core protocol defines the framework, while **payment methods** define how specific networks integrate:

:::info\[Extensible by design]
Anyone can define new payment methods. The protocol requires that methods define their `request` schema (what the server asks for) and `payload` schema (what the client provides as proof).
:::

| Method                            | Description                                     | Status                                      |
| --------------------------------- | ----------------------------------------------- | ------------------------------------------- |
| [Tempo](/payment-methods/tempo)   | Native stablecoin payments on Tempo Network     | <Badge variant="success">Production</Badge> |
| [Stripe](/payment-methods/stripe) | Traditional card payment methods through Stripe | <Badge variant="success">Production</Badge> |

Each payment method specifies its own `request` and `payload` schemas while sharing the common Challenge/Credential flow.

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
* **`session`**—Streaming payment over a payment channel

Intent Specifications define:

* Required and optional `request` fields
* `payload` requirements
* Verification and settlement semantics

Servers can offer multiple intents in separate challenges, allowing clients to choose:

```http
WWW-Authenticate: Payment id="abc", method="tempo", intent="charge", ...
WWW-Authenticate: Payment id="def", method="tempo", intent="session", ...
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

| Code                   | Description                                    |
| ---------------------- | ---------------------------------------------- |
| `payment-required`     | Resource requires payment                      |
| `payment-insufficient` | Amount too low                                 |
| `payment-expired`      | Challenge or authorization expired             |
| `verification-failed`  | Proof invalid                                  |
| `method-unsupported`   | Method not accepted                            |
| `malformed-credential` | Invalid credential format                      |
| `invalid-challenge`    | Challenge ID unknown, expired, or already used |

Use the `Retry-After` header to indicate when clients can retry failed payments.

## Security considerations

### Transport security

**TLS 1.2 or later is REQUIRED** for all Payment authentication flows. Use TLS 1.3 where possible. Payment Credentials contain sensitive authorization data that could result in financial loss if intercepted.

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

These docs provide a practical overview. For the full specification:

<Cards>
  <SpecCard to="https://paymentauth.org/draft-httpauth-payment-00" title="Payment HTTP Authentication Scheme" description="Core protocol spec (draft-httpauth-payment-00)" />

  <SpecCard to="https://paymentauth.org/draft-payment-transport-mcp-00" title="MCP Transport" description="Model Context Protocol binding" />

  <SpecCard to="https://paymentauth.org" title="Payment Methods and Intents" description="Method and intent definitions (charge, session)" />

  <SpecCard to="https://paymentauth.org" title="All Specifications" description="Browse the full specification directory" />
</Cards>

The full specification includes detailed ABNF grammar, security analysis, IANA considerations, and complete examples for various payment scenarios.

# Quickstart \[Get started with MPP in minutes]

MPP lets APIs charge for access. Servers request payment when you hit a paid endpoint; clients pay; servers verify and return the resource. [Learn more](/protocol).

## Start prompting

Paste one of these into your coding agent to build your first MPP app or service:

<QuickstartPrompts />

## Start building

Pick a starting point based on your role:

<Cards>
  <ClientQuickstartCard />

  <ServerQuickstartCard />

  <WalletCliCard />
</Cards>

# SDKs \[Official implementations in multiple languages]

<Cards>
  <TypeScriptSdkCard />

  <PythonSdkCard />

  <RustSdkCard />
</Cards>

# Build with an LLM \[Give your agent MPP context]

Point your coding agent at <a href="/llms-full.txt" target="_self">`llms-full.txt`</a>, a single file containing the complete documentation.

## Get started

Copy this URL and paste it into your agent:

```bash [terminal]
https://mpp.dev/llms-full.txt
```

Your agent now has full context on MPP's client and server APIs, payment methods, and integration patterns.

## Advanced options

These alternatives provide different ways to consume the docs depending on your workflow.

### Agent skills

Install skills for your coding agent using the [`skills` CLI](https://github.com/vercel-labs/skills):

```bash [terminal]
npx skills add tempoxyz/mpp -g
```

After installing, your agent knows how to integrate `mppx` with your chosen framework.

### llms.txt

Each page has a [`llms.txt`](https://llmstxt.org) file for LLM consumption:

* <a href="/llms.txt" target="_self">`llms.txt`</a>: A concise index of all pages with titles and descriptions
* <a href="/llms-full.txt" target="_self">`llms-full.txt`</a>: Complete documentation content in a single file

### MCP server

Connect the docs as an [MCP server](https://modelcontextprotocol.io) so your agent can search and read pages directly:

::::code-group

```bash [Claude]
claude mcp add --transport http mpp https://mpp.dev/api/mcp
```

```bash [Codex]
codex mcp add --transport http mpp https://mpp.dev/api/mcp
```

```bash [Amp]
amp mcp add --transport http mpp https://mpp.dev/api/mcp
```

```json [Manual]
// Claude: .mcp.json | Cursor: ~/.cursor/mcp.json
// Windsurf: ~/.codeium/windsurf/mcp_config.json
{
  "mcpServers": {
    "mpp": {
      "url": "https://mpp.dev/api/mcp"
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

# Accept multiple payment methods \[Stablecoins, cards, and Bitcoin on a single endpoint]

Build a payment-gated API that accepts [Tempo](/payment-methods/tempo) stablecoins, [Stripe](/payment-methods/stripe) cards, and [Lightning](/payment-methods/lightning) Bitcoin—all on the same endpoint. The server returns a `402` Challenge advertising every available method, and the client pays with whichever rail it supports.

:::info
MPP's multi-method support is additive. Each payment method is independent—you can start with one and add more at any time without changing your route handlers.
:::

## Prompt mode

Paste this into your coding agent to build the entire guide in one prompt:

<PromptBlock>
  {`Use https://mpp.dev/guides/multiple-payment-methods.md as reference.
    Add mppx to my app with a payment-gated endpoint that accepts
    three payment methods: Tempo, Stripe, and Lightning. Charge $0.01 per request.
    When payment is verified via any method, return a JSON response.`}
</PromptBlock>

## How it works

When multiple methods are registered, the `402` response includes a `WWW-Authenticate` header for each one. The client picks the method it supports and sends the appropriate Credential.

```
HTTP/1.1 402 Payment Required
WWW-Authenticate: Payment method="tempo", intent="charge", ...
WWW-Authenticate: Payment method="stripe", intent="charge", ...
WWW-Authenticate: Payment method="lightning", intent="charge", ...
```

The server verifies whichever Credential it receives. Your route handler stays the same regardless of which method the client chose.

## Server setup

::::steps

#### Install dependencies

:::code-group

```bash [npm]
npm install mppx stripe @buildonspark/lightning-mpp-sdk viem
```

```bash [pnpm]
pnpm add mppx stripe @buildonspark/lightning-mpp-sdk viem
```

```bash [bun]
bun add mppx stripe @buildonspark/lightning-mpp-sdk viem
```

:::

#### Configure payment methods

Register all three methods in a single `Mppx.create` call. Each method has its own configuration—Tempo needs a recipient address and currency, Stripe needs API credentials, and Lightning needs a wallet mnemonic.

```ts [server.ts]
import Stripe from 'stripe'
import { Mppx, tempo, stripe } from 'mppx/server'
import { spark } from '@buildonspark/lightning-mpp-sdk/server'

const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY!)

const mppx = Mppx.create({
  secretKey: process.env.MPP_SECRET_KEY || crypto.randomBytes(32).toString('base64'),
  methods: [
    tempo({
      testnet: true,
      currency: '0x20c0000000000000000000000000000000000000', // pathUSD on Tempo
      recipient: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
    }),
    stripe.charge({
      client: stripeClient,
      networkId: 'internal',
      paymentMethodTypes: ['card'],
    }),
    spark.charge({
      mnemonic: process.env.MNEMONIC!,
    }),
  ],
})
```

#### Create a payment-gated route

The route handler is identical to a single-method setup. `mppx.charge` advertises all registered methods in the Challenge and verifies whichever Credential the client presents.

```ts [server.ts]
import crypto from 'crypto'
import Stripe from 'stripe'
import { Mppx, tempo, stripe } from 'mppx/server'
import { spark } from '@buildonspark/lightning-mpp-sdk/server'

const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY!)

const mppx = Mppx.create({
  secretKey: process.env.MPP_SECRET_KEY || crypto.randomBytes(32).toString('base64'),
  methods: [
    tempo({
      testnet: true,
      currency: '0x20c0000000000000000000000000000000000000', // pathUSD on Tempo
      recipient: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
    }),
    stripe.charge({
      client: stripeClient,
      networkId: 'internal',
      paymentMethodTypes: ['card'],
    }),
    spark.charge({
      mnemonic: process.env.MNEMONIC!,
    }),
  ],
})

// [!code focus:start]
Bun.serve({
  async fetch(request) {
    const result = await mppx.charge({
      amount: '0.01',
      currency: 'usd',
      decimals: 2,
      description: 'Premium API access',
    })(request)

    if (result.status === 402) return result.challenge

    return result.withReceipt(Response.json({ message: 'Paid content' }))
  },
})
// [!code focus:end]
```

#### Test via the `mppx` CLI

The `mppx` CLI uses Tempo by default. Each payment method has its own client SDK—see the individual method docs for client setup.

```bash [terminal]
# Create account funded with testnet tokens
$ npx mppx account create

# Make a paid request (pays with Tempo)
$ npx mppx http://localhost:3000
```

::::

## Framework examples

The `Mppx.create` configuration is the same across frameworks—only the route handler syntax changes.

### Hono

```ts [server.ts]
import crypto from 'crypto'
import { Hono } from 'hono'
import Stripe from 'stripe'
import { Mppx, tempo, stripe } from 'mppx/hono'
import { spark } from '@buildonspark/lightning-mpp-sdk/server'

const app = new Hono()
const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY!)

const mppx = Mppx.create({
  secretKey: process.env.MPP_SECRET_KEY || crypto.randomBytes(32).toString('base64'),
  methods: [
    tempo({
      testnet: true,
      currency: '0x20c0000000000000000000000000000000000000', // pathUSD on Tempo
      recipient: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
    }),
    stripe.charge({
      client: stripeClient,
      networkId: 'internal',
      paymentMethodTypes: ['card'],
    }),
    spark.charge({
      mnemonic: process.env.MNEMONIC!,
    }),
  ],
})

app.get(
  '/api/resource',
  mppx.charge({ amount: '0.01', currency: 'usd', decimals: 2, description: 'Premium API access' }),
  async (c) => c.json({ message: 'Paid content' }),
)
```

### Express

```ts [server.ts]
import crypto from 'crypto'
import express from 'express'
import Stripe from 'stripe'
import { Mppx, tempo, stripe } from 'mppx/express'
import { spark } from '@buildonspark/lightning-mpp-sdk/server'

const app = express()
const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY!)

const mppx = Mppx.create({
  secretKey: process.env.MPP_SECRET_KEY || crypto.randomBytes(32).toString('base64'),
  methods: [
    tempo({
      testnet: true,
      currency: '0x20c0000000000000000000000000000000000000', // pathUSD on Tempo
      recipient: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
    }),
    stripe.charge({
      client: stripeClient,
      networkId: 'internal',
      paymentMethodTypes: ['card'],
    }),
    spark.charge({
      mnemonic: process.env.MNEMONIC!,
    }),
  ],
})

app.get(
  '/api/resource',
  mppx.charge({ amount: '0.01', currency: 'usd', decimals: 2, description: 'Premium API access' }),
  async (req, res) => res.json({ message: 'Paid content' }),
)
```

### Next.js

```ts [app/api/resource/route.ts]
import crypto from 'crypto'
import Stripe from 'stripe'
import { Mppx, tempo, stripe } from 'mppx/nextjs'
import { spark } from '@buildonspark/lightning-mpp-sdk/server'

const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY!)

const mppx = Mppx.create({
  secretKey: process.env.MPP_SECRET_KEY || crypto.randomBytes(32).toString('base64'),
  methods: [
    tempo({
      testnet: true,
      currency: '0x20c0000000000000000000000000000000000000', // pathUSD on Tempo
      recipient: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
    }),
    stripe.charge({
      client: stripeClient,
      networkId: 'internal',
      paymentMethodTypes: ['card'],
    }),
    spark.charge({
      mnemonic: process.env.MNEMONIC!,
    }),
  ],
})

export const GET =
  mppx.charge({ amount: '0.01', currency: 'usd', decimals: 2, description: 'Premium API access' })
  (async () => Response.json({ message: 'Paid content' }))
```

## Method-specific configuration

Each payment method has its own parameters. Refer to the individual method docs for the full configuration reference:

## Next steps

# Accept one-time payments \[Charge per request with a payment-gated API]

Build a payment-gated image generation API that charges $0.01 per request using `mppx`.
The server returns a random photo from [Picsum](https://picsum.photos) behind a paywall,
but you could swap in an AI model like [OpenAI Image Generation](https://developers.openai.com/api/reference/resources/images) instead.

## Demo

Try the payment-gated image generation API. Click **Run demo** to create a wallet, fund it, and make a paid request.

<div style={{ height: 480 }}>
  <TerminalPhoto />
</div>

## Prompt mode

Paste this into your coding agent to build the entire guide in one prompt:

<PromptBlock>
  {`Use https://mpp.dev/guides/one-time-payments.md as reference.
    Add mppx to my app with a payment-gated photo endpoint 
    that charges $0.01 per request using the Tempo payment method with 
    PathUSD. When payment is verified, fetch a random photo from 
    https://picsum.photos/1024/1024 and return the URL as JSON.`}
</PromptBlock>

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
      secretKey: process.env.MPP_SECRET_KEY || crypto.randomBytes(32).toString('base64'),
      methods: [tempo({
        testnet: true,
        currency: '0x20c0000000000000000000000000000000000000',
        recipient: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
      })],
    })
    ```

    #### Create the `/api/photo` route

    Create the photo route. This route is **currently unpaid**.

    ```ts [app/api/photo/route.ts]
    import crypto from 'crypto'
    import { Mppx, tempo } from 'mppx/nextjs'

    export const mppx = Mppx.create({
      secretKey: process.env.MPP_SECRET_KEY || crypto.randomBytes(32).toString('base64'),
      methods: [tempo({
        testnet: true,
        currency: '0x20c0000000000000000000000000000000000000',
        recipient: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
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
    import crypto from 'crypto'
    import { Mppx, tempo } from 'mppx/nextjs'

    export const mppx = Mppx.create({
      secretKey: process.env.MPP_SECRET_KEY || crypto.randomBytes(32).toString('base64'),
      methods: [tempo({
        testnet: true,
        currency: '0x20c0000000000000000000000000000000000000',
        recipient: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
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

    ```bash [terminal]
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
      secretKey: process.env.MPP_SECRET_KEY || crypto.randomBytes(32).toString('base64'),
      methods: [tempo({
        testnet: true,
        currency: '0x20c0000000000000000000000000000000000000',
        recipient: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
      })],
    })
    ```

    #### Create the `/api/photo` route

    Create the photo route. This route is **currently unpaid**.

    ```ts [server.ts]
    import crypto from 'crypto'
    import { Hono } from 'hono'
    import { Mppx, tempo } from 'mppx/hono'

    const app = new Hono()

    const mppx = Mppx.create({
      secretKey: process.env.MPP_SECRET_KEY || crypto.randomBytes(32).toString('base64'),
      methods: [tempo({
        testnet: true,
        currency: '0x20c0000000000000000000000000000000000000',
        recipient: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
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
    import crypto from 'crypto'
    import { Hono } from 'hono'
    import { Mppx, tempo } from 'mppx/hono'

    const app = new Hono()

    const mppx = Mppx.create({
      secretKey: process.env.MPP_SECRET_KEY || crypto.randomBytes(32).toString('base64'),
      methods: [tempo({
        testnet: true,
        currency: '0x20c0000000000000000000000000000000000000',
        recipient: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
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

    ```bash [terminal]
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
      secretKey: process.env.MPP_SECRET_KEY || crypto.randomBytes(32).toString('base64'),
      methods: [tempo({
        testnet: true,
        currency: '0x20c0000000000000000000000000000000000000',
        recipient: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
      })],
    })
    ```

    #### Create the `/api/photo` route

    Create the photo route. This route is **currently unpaid**.

    ```ts [src/index.ts]
    import crypto from 'crypto'
    import { Mppx, tempo } from 'mppx/server'

    const mppx = Mppx.create({
      secretKey: process.env.MPP_SECRET_KEY || crypto.randomBytes(32).toString('base64'),
      methods: [tempo({
        testnet: true,
        currency: '0x20c0000000000000000000000000000000000000',
        recipient: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
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
    import crypto from 'crypto'
    import { Mppx, tempo } from 'mppx/server'

    const mppx = Mppx.create({
      secretKey: process.env.MPP_SECRET_KEY || crypto.randomBytes(32).toString('base64'),
      methods: [tempo({
        testnet: true,
        currency: '0x20c0000000000000000000000000000000000000',
        recipient: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
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

    ```bash [terminal]
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
      secretKey: process.env.MPP_SECRET_KEY || crypto.randomBytes(32).toString('base64'),
      methods: [tempo({
        testnet: true,
        currency: '0x20c0000000000000000000000000000000000000',
        recipient: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
      })],
    })
    ```

    #### Create the `/api/photo` route

    Create the photo route. This route is **currently unpaid**.

    ```ts [server.ts]
    import crypto from 'crypto'
    import express from 'express'
    import { Mppx, tempo } from 'mppx/express'

    const app = express()

    const mppx = Mppx.create({
      secretKey: process.env.MPP_SECRET_KEY || crypto.randomBytes(32).toString('base64'),
      methods: [tempo({
        testnet: true,
        currency: '0x20c0000000000000000000000000000000000000',
        recipient: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
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
    import crypto from 'crypto'
    import express from 'express'
    import { Mppx, tempo } from 'mppx/express'

    const app = express()

    const mppx = Mppx.create({
      secretKey: process.env.MPP_SECRET_KEY || crypto.randomBytes(32).toString('base64'),
      methods: [tempo({
        testnet: true,
        currency: '0x20c0000000000000000000000000000000000000',
        recipient: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
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

    ```bash [terminal]
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
      secretKey: process.env.MPP_SECRET_KEY || crypto.randomBytes(32).toString('base64'),
      methods: [tempo({
        testnet: true,
        currency: '0x20c0000000000000000000000000000000000000',
        recipient: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
      })],
    })
    ```

    #### Create the `/api/photo` route

    Create the photo route. This route is **currently unpaid**.

    ```ts [server.ts]
    import crypto from 'crypto'
    import { Mppx, tempo } from 'mppx/server'

    const mppx = Mppx.create({
      secretKey: process.env.MPP_SECRET_KEY || crypto.randomBytes(32).toString('base64'),
      methods: [tempo({
        testnet: true,
        currency: '0x20c0000000000000000000000000000000000000',
        recipient: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
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
    import crypto from 'crypto'
    import { Mppx, tempo } from 'mppx/server'

    const mppx = Mppx.create({
      secretKey: process.env.MPP_SECRET_KEY || crypto.randomBytes(32).toString('base64'),
      methods: [tempo({
        testnet: true,
        currency: '0x20c0000000000000000000000000000000000000',
        recipient: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
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

    ```bash [terminal]
    # Create account funded with testnet tokens
    $ npx mppx account create

    # Make a paid request
    $ npx mppx http://localhost:3000
    ```

    ::::
  </Tab>
</Tabs>

## With Stripe

Create a dynamic recipient address to link each transaction to a backing Payment Intent in Stripe.

```ts twoslash
// @noErrors
import { Mppx, tempo } from "mppx/server";

function async createPayToAddress(request: Request) {
  // Create Stripe PaymentIntent
}

export async function handler(request: Request) {
  const recipientAddress = await createPayToAddress(request)
  const mppx = Mppx.create({
    secretKey: process.env.MPP_SECRET_KEY || crypto.randomBytes(32).toString('base64'),
    methods: [
      tempo.charge({
        testnet: true,
        currency: "0x20c0000000000000000000000000000000000000",
        recipient: recipientAddress,
      }),
    ],
  });

  const result = await mppx.charge({ amount: "0.01" })(request);

  if (result.status === 402) return result.challenge;

  return result.withReceipt(Response.json({ data: "..." }));
}
```

Refunds, reporting, and multi-currency payouts work the same as any other payment in Stripe. Read the [Stripe documentation](https://docs.stripe.com/payments/machine/mpp) on accepting MPP.

## Next steps

# Accept pay-as-you-go payments \[Session-based billing with payment channels]

Build a payment-gated photo gallery API that charges $0.01 per photo using `mppx` sessions.
The server returns random photos from [Picsum](https://picsum.photos) behind a paywall,
but you could imagine generating images with an AI model instead like [OpenAI Image Generation](https://developers.openai.com/api/reference/resources/images).

:::info
Unlike [one-time payments](/guides/one-time-payments), sessions open a payment channel once and
use offchain vouchers for each subsequent request—vouchers are **not bottlenecked by blockchain throughput**, they are processed in pure CPU-bound signature checks.
:::

## Demo

Try the payment-gated photo gallery API. Click **Run demo** to create a wallet, fund it, and generate a gallery of paid photos.

<div style={{ height: 480 }}>
  <TerminalGallery />
</div>

## Prompt mode

Paste this into your coding agent to build the entire guide in one prompt:

<PromptBlock>
  {`Use https://mpp.dev/guides/pay-as-you-go.md as reference.
    Add mppx to my app with a payment-gated gallery endpoint
    that charges $0.01 per photo using the Tempo session payment method with
    PathUSD. When payment is verified, fetch a random photo from
    https://picsum.photos/200/200 and return the URL as JSON.`}
</PromptBlock>

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
    import crypto from 'crypto'
    import { Mppx, tempo } from 'mppx/nextjs'

    export const mppx = Mppx.create({
      secretKey: process.env.MPP_SECRET_KEY || crypto.randomBytes(32).toString('base64'),
      methods: [tempo({
        testnet: true,
        currency: '0x20c0000000000000000000000000000000000000',
        recipient: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
      })],
    })
    ```

    #### Create the `/api/sessions/photo` route

    Create the gallery route. This route is **currently unpaid**.

    ```ts [app/api/sessions/photo/route.ts]
    import crypto from 'crypto'
    import { Mppx, tempo } from 'mppx/nextjs'

    export const mppx = Mppx.create({
      secretKey: process.env.MPP_SECRET_KEY || crypto.randomBytes(32).toString('base64'),
      methods: [tempo({
        testnet: true,
        currency: '0x20c0000000000000000000000000000000000000',
        recipient: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
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
    import crypto from 'crypto'
    import { Mppx, tempo } from 'mppx/nextjs'

    export const mppx = Mppx.create({
      secretKey: process.env.MPP_SECRET_KEY || crypto.randomBytes(32).toString('base64'),
      methods: [tempo({
        testnet: true,
        currency: '0x20c0000000000000000000000000000000000000',
        recipient: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
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

    ```bash [terminal]
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
    import crypto from 'crypto'
    import { Hono } from 'hono'
    import { Mppx, tempo } from 'mppx/hono'

    const app = new Hono()

    const mppx = Mppx.create({
      secretKey: process.env.MPP_SECRET_KEY || crypto.randomBytes(32).toString('base64'),
      methods: [tempo({
        testnet: true,
        currency: '0x20c0000000000000000000000000000000000000',
        recipient: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
      })],
    })
    ```

    ```ts [server.ts]
    import crypto from 'crypto'
    import { Hono } from 'hono'
    import { Mppx, tempo } from 'mppx/hono'

    const app = new Hono()

    const mppx = Mppx.create({
      secretKey: process.env.MPP_SECRET_KEY || crypto.randomBytes(32).toString('base64'),
      methods: [tempo({
        testnet: true,
        currency: '0x20c0000000000000000000000000000000000000',
        recipient: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
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
    import crypto from 'crypto'
    import { Hono } from 'hono'
    import { Mppx, tempo } from 'mppx/hono'

    const app = new Hono()

    const mppx = Mppx.create({
      secretKey: process.env.MPP_SECRET_KEY || crypto.randomBytes(32).toString('base64'),
      methods: [tempo({
        testnet: true,
        currency: '0x20c0000000000000000000000000000000000000',
        recipient: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
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

    ```bash [terminal]
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
    import crypto from 'crypto'
    import { Mppx, tempo } from 'mppx/server'

    const mppx = Mppx.create({
      secretKey: process.env.MPP_SECRET_KEY || crypto.randomBytes(32).toString('base64'),
      methods: [tempo({
        testnet: true,
        currency: '0x20c0000000000000000000000000000000000000',
        recipient: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
      })],
    })
    ```

    #### Create the gallery route

    Create the gallery route. This route is **currently unpaid**.

    ```ts [src/index.ts]
    import crypto from 'crypto'
    import { Mppx, tempo } from 'mppx/server'

    const mppx = Mppx.create({
      secretKey: process.env.MPP_SECRET_KEY || crypto.randomBytes(32).toString('base64'),
      methods: [tempo({
        testnet: true,
        currency: '0x20c0000000000000000000000000000000000000',
        recipient: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
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
    import crypto from 'crypto'
    import { Mppx, tempo } from 'mppx/server'

    const mppx = Mppx.create({
      secretKey: process.env.MPP_SECRET_KEY || crypto.randomBytes(32).toString('base64'),
      methods: [tempo({
        testnet: true,
        currency: '0x20c0000000000000000000000000000000000000',
        recipient: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
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

    ```bash [terminal]
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
    import crypto from 'crypto'
    import express from 'express'
    import { Mppx, tempo } from 'mppx/express'

    const app = express()

    const mppx = Mppx.create({
      secretKey: process.env.MPP_SECRET_KEY || crypto.randomBytes(32).toString('base64'),
      methods: [tempo({
        testnet: true,
        currency: '0x20c0000000000000000000000000000000000000',
        recipient: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
      })],
    })
    ```

    #### Create the `/api/sessions/photo` route

    Create the gallery route. This route is **currently unpaid**.

    ```ts [server.ts]
    import crypto from 'crypto'
    import express from 'express'
    import { Mppx, tempo } from 'mppx/express'

    const app = express()

    const mppx = Mppx.create({
      secretKey: process.env.MPP_SECRET_KEY || crypto.randomBytes(32).toString('base64'),
      methods: [tempo({
        testnet: true,
        currency: '0x20c0000000000000000000000000000000000000',
        recipient: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
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
    import crypto from 'crypto'
    import express from 'express'
    import { Mppx, tempo } from 'mppx/express'

    const app = express()

    const mppx = Mppx.create({
      secretKey: process.env.MPP_SECRET_KEY || crypto.randomBytes(32).toString('base64'),
      methods: [tempo({
        testnet: true,
        currency: '0x20c0000000000000000000000000000000000000',
        recipient: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
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

    ```bash [terminal]
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
      secretKey: process.env.MPP_SECRET_KEY || crypto.randomBytes(32).toString('base64'),
      methods: [tempo({
        testnet: true,
        currency: '0x20c0000000000000000000000000000000000000',
        recipient: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
      })],
    })
    ```

    #### Create the `/api/sessions/photo` route

    Create the gallery route. This route is **currently unpaid**.

    ```ts [server.ts]
    import crypto from 'crypto'
    import { Mppx, tempo } from 'mppx/server'

    const mppx = Mppx.create({
      secretKey: process.env.MPP_SECRET_KEY || crypto.randomBytes(32).toString('base64'),
      methods: [tempo({
        testnet: true,
        currency: '0x20c0000000000000000000000000000000000000',
        recipient: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
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
    import crypto from 'crypto'
    import { Mppx, tempo } from 'mppx/server'

    const mppx = Mppx.create({
      secretKey: process.env.MPP_SECRET_KEY || crypto.randomBytes(32).toString('base64'),
      methods: [tempo({
        testnet: true,
        currency: '0x20c0000000000000000000000000000000000000',
        recipient: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
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

    ```bash [terminal]
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

* **`maxDeposit: '1'`**: Locks up to 1 pathUSD into the payment channel. At $0.01/photo, this covers up to 100 requests before the channel runs out.
* The client handles the full session lifecycle automatically: channel open, voucher signing, and retry after `402` responses.
* If the server sets `suggestedDeposit`, the client uses `min(suggestedDeposit, maxDeposit)`.

### Closing the channel

After you're done making requests, close the channel to settle on-chain and reclaim unspent deposit:

```ts twoslash [client.ts]
import { tempo } from 'mppx/client'
import { privateKeyToAccount } from 'viem/accounts'

const session = tempo.session({
  account: privateKeyToAccount('0x...'),
  maxDeposit: '1',
})

const res = await session.fetch('http://localhost:3000/api/sessions/photo')

// Settle on-chain and reclaim unspent deposit
const receipt = await session.close()
```

:::info
Channels remain open for reuse. Closing is not required between individual requests—only when you're done with the session entirely.
:::

## Next steps

# Accept streamed payments \[Per-token billing over Server-Sent Events]

Build a payment-gated poetry API that streams poems word-by-word and charges $0.001 per word using `mppx` sessions with Server-Sent Events (SSE).

:::info
Streamed payments extend [pay-as-you-go sessions](/guides/pay-as-you-go) with SSE. The server charges per token as content streams—if the channel balance runs out mid-stream, the client automatically sends a new voucher and the stream resumes.
:::

## Demo

Try the payment-gated poetry API. Click **Run demo** to create a wallet, fund it, and stream a paid poem.

<div style={{ height: 480 }}>
  <TerminalPoem />
</div>

## Prompt mode

Paste this into your coding agent to build the entire guide in one prompt:

<PromptBlock>
  {`Use https://mpp.dev/guides/streamed-payments.md as reference.
    Add mppx to my app with a payment-gated SSE endpoint
    that streams text word-by-word and charges $0.001 per word using the
    Tempo session payment method with PathUSD and sse: true.`}
</PromptBlock>

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
    import crypto from 'crypto'
    import { Mppx, tempo } from "mppx/nextjs";

    export const mppx = Mppx.create({
      secretKey: process.env.MPP_SECRET_KEY || crypto.randomBytes(32).toString('base64'),
      methods: [
        tempo({
          testnet: true,
          currency: "0x20c0000000000000000000000000000000000000",
          recipient: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
          sse: true,
        }),
      ],
    });
    ```

    #### Create the `/api/sessions/poem` route

    Create the poem route. The `withReceipt` method accepts an async generator—each yielded value is one SSE event and one charged word.

    ```ts [app/api/sessions/poem/route.ts]
    import crypto from 'crypto'
    import { Mppx, tempo } from "mppx/nextjs";

    export const mppx = Mppx.create({
      secretKey: process.env.MPP_SECRET_KEY || crypto.randomBytes(32).toString('base64'),
      methods: [
        tempo({
          testnet: true,
          currency: "0x20c0000000000000000000000000000000000000",
          recipient: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
          sse: true,
        }),
      ],
    });

    // [!code focus:start]
    const poem = {
      title: "The Road Not Taken",
      author: "Robert Frost",
      lines: [
        "Two roads diverged in a yellow wood,",
        "And sorry I could not travel both",
        "And be one traveler, long I stood",
        "And looked down one as far as I could",
        "To where it bent in the undergrowth;",
      ],
    };

    export const GET = mppx.session({ amount: "0.001", unitType: "word" })(
      async () => {
        const words = poem.lines.flatMap((line) => [...line.split(" "), "\\n"]);
        return async function* (stream) {
          yield JSON.stringify({ title: poem.title, author: poem.author });
          for (const word of words) {
            await stream.charge();
            yield word;
          }
        };
      },
    );
    // [!code focus:end]
    ```

    #### Test via the `mppx` CLI

    ```bash [terminal]
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
    import crypto from 'crypto'
    import { Hono } from "hono";
    import { Mppx, tempo } from "mppx/hono";

    const app = new Hono();

    const mppx = Mppx.create({
      secretKey: process.env.MPP_SECRET_KEY || crypto.randomBytes(32).toString('base64'),
      methods: [
        tempo({
          testnet: true,
          currency: "0x20c0000000000000000000000000000000000000",
          recipient: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
          sse: true,
        }),
      ],
    });
    ```

    #### Create the `/api/sessions/poem` route

    Create the poem route with the session middleware. The handler returns an async generator—each yielded value is one SSE event and one charged word.

    ```ts [server.ts]
    import crypto from 'crypto'
    import { Hono } from "hono";
    import { Mppx, tempo } from "mppx/hono";

    const app = new Hono();

    const mppx = Mppx.create({
      secretKey: process.env.MPP_SECRET_KEY || crypto.randomBytes(32).toString('base64'),
      methods: [
        tempo({
          testnet: true,
          currency: "0x20c0000000000000000000000000000000000000",
          recipient: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
          sse: true,
        }),
      ],
    });

    // [!code focus:start]
    const poem = {
      title: "The Road Not Taken",
      author: "Robert Frost",
      lines: [
        "Two roads diverged in a yellow wood,",
        "And sorry I could not travel both",
        "And be one traveler, long I stood",
        "And looked down one as far as I could",
        "To where it bent in the undergrowth;",
      ],
    };

    app.get(
      "/api/sessions/poem",
      mppx.session({ amount: "0.001", unitType: "word" }),
      async (c) => {
        const words = poem.lines.flatMap((line) => [...line.split(" "), "\\n"]);
        return async function* (stream) {
          yield JSON.stringify({ title: poem.title, author: poem.author });
          for (const word of words) {
            await stream.charge();
            yield word;
          }
        };
      },
    );
    // [!code focus:end]
    ```

    #### Test via the `mppx` CLI

    ```bash [terminal]
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
    import crypto from 'crypto'
    import { Mppx, tempo } from "mppx/server";

    const mppx = Mppx.create({
      secretKey: process.env.MPP_SECRET_KEY || crypto.randomBytes(32).toString('base64'),
      methods: [
        tempo({
          testnet: true,
          currency: "0x20c0000000000000000000000000000000000000",
          recipient: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
          sse: true,
        }),
      ],
    });
    ```

    #### Create the `/api/sessions/poem` route

    Create the poem route. The `withReceipt` method accepts an async generator—each yielded value is one SSE event and one charged word.

    ```ts [src/index.ts]
    import crypto from 'crypto'
    import { Mppx, tempo } from "mppx/server";

    const mppx = Mppx.create({
      secretKey: process.env.MPP_SECRET_KEY || crypto.randomBytes(32).toString('base64'),
      methods: [
        tempo({
          testnet: true,
          currency: "0x20c0000000000000000000000000000000000000",
          recipient: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
          sse: true,
        }),
      ],
    });

    // [!code focus:start]
    const poem = {
      title: "The Road Not Taken",
      author: "Robert Frost",
      lines: [
        "Two roads diverged in a yellow wood,",
        "And sorry I could not travel both",
        "And be one traveler, long I stood",
        "And looked down one as far as I could",
        "To where it bent in the undergrowth;",
      ],
    };

    export default {
      async fetch(request: Request) {
        const result = await mppx.session({
          amount: "0.001",
          unitType: "word",
        })(request);

        if (result.status === 402) return result.challenge;

        const words = poem.lines.flatMap((line) => [...line.split(" "), "\\n"]);
        return result.withReceipt(async function* (stream) {
          yield JSON.stringify({ title: poem.title, author: poem.author });
          for (const word of words) {
            await stream.charge();
            yield word;
          }
        });
      },
    };
    // [!code focus:end]
    ```

    #### Test via the `mppx` CLI

    ```bash [terminal]
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
    import crypto from 'crypto'
    import express from "express";
    import { Mppx, tempo } from "mppx/express";

    const app = express();

    const mppx = Mppx.create({
      secretKey: process.env.MPP_SECRET_KEY || crypto.randomBytes(32).toString('base64'),
      methods: [
        tempo({
          testnet: true,
          currency: "0x20c0000000000000000000000000000000000000",
          recipient: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
          sse: true,
        }),
      ],
    });
    ```

    #### Create the `/api/sessions/poem` route

    Create the poem route with the session middleware. The handler returns an async generator—each yielded value is one SSE event and one charged word.

    ```ts [server.ts]
    import crypto from 'crypto'
    import express from "express";
    import { Mppx, tempo } from "mppx/express";

    const app = express();

    const mppx = Mppx.create({
      secretKey: process.env.MPP_SECRET_KEY || crypto.randomBytes(32).toString('base64'),
      methods: [
        tempo({
          testnet: true,
          currency: "0x20c0000000000000000000000000000000000000",
          recipient: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
          sse: true,
        }),
      ],
    });

    // [!code focus:start]
    const poem = {
      title: "The Road Not Taken",
      author: "Robert Frost",
      lines: [
        "Two roads diverged in a yellow wood,",
        "And sorry I could not travel both",
        "And be one traveler, long I stood",
        "And looked down one as far as I could",
        "To where it bent in the undergrowth;",
      ],
    };

    app.get(
      "/api/sessions/poem",
      mppx.session({ amount: "0.001", unitType: "word" }),
      async (req, res) => {
        const words = poem.lines.flatMap((line) => [...line.split(" "), "\\n"]);
        return async function* (stream) {
          yield JSON.stringify({ title: poem.title, author: poem.author });
          for (const word of words) {
            await stream.charge();
            yield word;
          }
        };
      },
    );
    // [!code focus:end]
    ```

    #### Test via the `mppx` CLI

    ```bash [terminal]
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
    import crypto from 'crypto'
    import { Mppx, tempo } from "mppx/server";

    const mppx = Mppx.create({
      secretKey: process.env.MPP_SECRET_KEY || crypto.randomBytes(32).toString('base64'),
      methods: [
        tempo({
          testnet: true,
          currency: "0x20c0000000000000000000000000000000000000",
          recipient: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
          sse: true,
        }),
      ],
    });
    ```

    #### Create the streaming poem route

    Create the route handler. `withReceipt` accepts an async generator—each yielded value becomes one SSE `event: message` and is charged one tick (`$0.001`). If the channel balance runs out mid-stream, the server emits `event: payment-need-voucher` and pauses until the client sends a new voucher.

    ```ts [server.ts]
    import crypto from 'crypto'
    import { Mppx, tempo } from "mppx/server";

    const mppx = Mppx.create({
      secretKey: process.env.MPP_SECRET_KEY || crypto.randomBytes(32).toString('base64'),
      methods: [
        tempo({
          testnet: true,
          currency: "0x20c0000000000000000000000000000000000000",
          recipient: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
          sse: true,
        }),
      ],
    });

    // [!code focus:start]
    const poem = {
      title: "The Road Not Taken",
      author: "Robert Frost",
      lines: [
        "Two roads diverged in a yellow wood,",
        "And sorry I could not travel both",
        "And be one traveler, long I stood",
        "And looked down one as far as I could",
        "To where it bent in the undergrowth;",
      ],
    };

    Bun.serve({
      async fetch(request) {
        const result = await mppx.session({
          amount: "0.001",
          unitType: "word",
        })(request);

        if (result.status === 402) return result.challenge;

        const words = poem.lines.flatMap((line) => [...line.split(" "), "\\n"]);
        return result.withReceipt(async function* (stream) {
          yield JSON.stringify({ title: poem.title, author: poem.author });
          for (const word of words) {
            await stream.charge();
            yield word;
          }
        });
      },
    });
    // [!code focus:end]
    ```

    #### Test via the `mppx` CLI

    ```bash [terminal]
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
import { tempo } from "mppx/client";
import { privateKeyToAccount } from "viem/accounts";

const session = tempo.session({
  account: privateKeyToAccount("0x..."),
  maxDeposit: "1", // Lock up to 1 pathUSD per channel
});

// .sse() returns an async iterable of SSE data payloads
const stream = await session.sse("http://localhost:3000/api/sessions/poem");

for await (const word of stream) {
  process.stdout.write(word + " ");
}
```

* **`tempo.session()`** — Creates a session manager that handles the full channel lifecycle: open, voucher signing, and close.
* **`.sse()`** — Connects to an SSE endpoint. Automatically sends new vouchers when the server emits `payment-need-voucher` events.
* **`maxDeposit: '1'`** — Locks up to 1 pathUSD. At $0.001/word, this covers ~1,000 words before the channel needs a top-up.

### Closing the channel

After streaming completes, close the channel to settle and reclaim unspent deposit:

```ts twoslash [client.ts]
import { tempo } from 'mppx/client'
import { privateKeyToAccount } from 'viem/accounts'

const session = tempo.session({
  account: privateKeyToAccount('0x...'),
  maxDeposit: '1',
})

const stream = await session.sse('http://localhost:3000/api/sessions/poem')

for await (const word of stream) {
  process.stdout.write(word + ' ')
}

// Settle on-chain and reclaim unspent deposit
const receipt = await session.close()
```

## Next steps

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

  <LightningMethodCard />

  <SolanaChargeCard />

  <CardMethodCard />
</Cards>

## Specification

<Cards>
  <SpecCard to="https://paymentauth.org/draft-payment-intent-charge-00" />
</Cards>

# Card \[Card payments via encrypted network tokens]

The Card method enables payments using encrypted, single use network payment tokens and dynamic data provided by a card network for machine-initiated transactions. Payment tokens, such as those provided by [Visa Intelligent Commerce](https://developer.visa.com/capabilities/visa-intelligent-commerce), settle through existing card infrastructure, and the client and server can each use independent payment providers rather than sharing a single platform.

The [`mpp-card`](https://www.npmjs.com/package/mpp-card) SDK implements the `card` method with the `charge` intent. The protocol is defined in the [Card Network Charge Intent](https://paymentauth.org/draft-card-charge-00) specification.

## Installation

:::code-group

```bash [npm]
npm install mpp-card
```

```bash [pnpm]
pnpm add mpp-card
```

```bash [bun]
bun add mpp-card
```

:::

## How it works

<MermaidDiagram
  chart={`sequenceDiagram
  participant Client
  participant CE as Client Enabler
  participant Server
  participant SE as Server Enabler
  Client->>Server: (1) GET /resource
  Server-->>Client: (2) 402 + Challenge (amount, networks, encryption key)
  Client->>CE: (3) cardId + challenge context
  CE-->>Client: (4) Encrypted network token (JWE)
  Client->>Server: (5) GET /resource + Credential (encrypted token)
  Server->>SE: (6) Decrypt token + charge card
  SE-->>Server: (7) Authorization reference
  Server-->>Client: (8) 200 OK + Receipt + resource
`}
/>

1. **Client** requests a resource from the server.
2. **Server** responds with `402` and a Challenge containing the amount, currency, accepted card networks, and an RSA public key (`encryptionJwk`).
3. **Client** sends the card identifier and challenge context to a credential issuer.
4. **Credential Issuer** provisions a network token, generates a cryptogram, and encrypts both as a JWE using the server's public key. The encrypted token is returned to the client.
5. **Client** retries the original request with an `Authorization: Payment` header containing the encrypted credential.
6. **Server** decrypts the token using its private key and forwards it to the payment gateway for authorization through the card network.
7. **Server** returns the resource with a `Payment-Receipt` header confirming the charge.

## Intents

<Cards>
  <CardChargeCard />
</Cards>

# Custom \[Build your own payment method]

The `mppx` SDK supports dynamic extensibility for new payment methods. You can implement custom payment methods to integrate any payment rail—other blockchains, card processors, or proprietary systems.

| Approach | Description | Best for |
|---|---|---|
| **[Dynamic extension](#dynamic-extension)** | Define a method inline in your app | Integrating a new payment rail |
| **[First-party SDK](#first-party-sdk)** | Package your method as a standalone npm module | Publishing a reusable method for the ecosystem |

## Dynamic extension

A custom payment method requires three pieces:

1. **Method definition** — Define the method name, intent, and schemas for request parameters and Credential payloads
2. **Client logic** — Create Credentials when the client gets a `402` response
3. **Server logic** — Verify Credentials and return Receipts

### Define a method

Start by defining your payment method with `Method.from`. The definition includes the method name, intent type, and schemas for request parameters and Credential payloads.

```ts twoslash [methods.ts]
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

### Client implementation

Extend the method with Credential creation logic using `Method.toClient`. The `createCredential` function runs when the client gets a `402` response:

```ts twoslash [methods.client.ts]
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

### Server implementation

Extend the method with verification logic using `Method.toServer`. For Lightning Network, verify that the preimage hashes to the payment hash:

```ts twoslash [methods.server.ts]
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
    if (actualHash !== expectedHash) {
      throw new Error('Preimage does not match payment hash')
    }

    return Receipt.from({
      method: 'lightning',
      reference: preimage,
      status: 'success',
      timestamp: new Date().toISOString(),
    })
  },
})
```

### Use in your app

#### Client

Pass the client method to `Mppx.create`:

```ts twoslash [client.ts]
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

#### Server

Pass the server method to `Mppx.create`:

```ts twoslash [server.ts]
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
    if (actualHash !== expectedHash) {
      throw new Error('Preimage does not match payment hash')
    }

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

### Advanced options

#### Pre-fill defaults

Use `defaults` to pre-fill request parameters so callers don't repeat them. Fields in `defaults` become optional at the call site.

```ts twoslash [methods.server.ts]
import { Method, Receipt, z } from 'mppx'

const lightning = Method.from({
  intent: 'charge',
  name: 'lightning',
  schema: {
    credential: { payload: z.object({ preimage: z.string() }) },
    request: z.object({ amount: z.string(), currency: z.string(), invoice: z.string(), paymentHash: z.string(), recipient: z.string() }),
  },
})
// ---cut---
const serverMethod = Method.toServer(lightning, {
  defaults: {
    currency: 'BTC',
    recipient: 'lnbc1...',
  },
  async verify({ credential }) {
    return Receipt.from({
      method: 'lightning',
      reference: credential.payload.preimage,
      status: 'success',
      timestamp: new Date().toISOString(),
    })
  },
})
```

#### Transform with `z.pipe`

Use `z.pipe` to accept human-readable input and emit a normalized wire format. The built-in `tempo` method uses this to convert dollar amounts to atomic units.

```ts twoslash [methods.ts]
import { Method, z } from 'mppx'
import { parseUnits } from 'viem'

export const charge = Method.from({
  intent: 'charge',
  name: 'acme-pay',
  schema: {
    credential: {
      payload: z.object({ receiptId: z.string() }),
    },
    request: z.pipe(
      z.object({
        amount: z.string(),
        currency: z.string(),
        decimals: z.number(),
        recipient: z.string(),
      }),
      z.transform(({ amount, decimals, ...rest }) => ({
        ...rest,
        amount: parseUnits(amount, decimals).toString(),
      })),
    ),
  },
})
```

Callers pass `{ amount: '1.50', decimals: 6 }`, the Challenge contains `{ amount: '1500000' }`. Use `parseUnits` from viem for decimal-safe conversion—never use `Number()` for monetary amounts.

#### Client context

Declare a `context` schema to accept per-call parameters. The context is validated at runtime before `createCredential` runs.

```ts twoslash [methods.client.ts]
import { Credential, Method, z } from 'mppx'

const lightning = Method.from({
  intent: 'charge',
  name: 'lightning',
  schema: {
    credential: { payload: z.object({ preimage: z.string() }) },
    request: z.object({ amount: z.string(), currency: z.string(), invoice: z.string(), paymentHash: z.string(), recipient: z.string() }),
  },
})

declare function payInvoice(invoice: string, maxFeeSats: number): Promise<{ preimage: string }>
// ---cut---
const clientMethod = Method.toClient(lightning, {
  context: z.object({ maxFeeSats: z.number() }),
  async createCredential({ challenge, context }) {
    const result = await payInvoice(challenge.request.invoice, context.maxFeeSats)
    return Credential.serialize({ challenge, payload: { preimage: result.preimage } })
  },
})
```

#### Request hook

Use the `request` hook to enrich parameters before the Challenge is issued:

```ts twoslash [methods.server.ts]
import { Method, Receipt, z } from 'mppx'

const lightning = Method.from({
  intent: 'charge',
  name: 'lightning',
  schema: {
    credential: { payload: z.object({ preimage: z.string() }) },
    request: z.object({ amount: z.string(), currency: z.string(), invoice: z.string(), paymentHash: z.string(), recipient: z.string() }),
  },
})

declare function createInvoice(amount: string): Promise<{ invoice: string; hash: string }>
// ---cut---
const serverMethod = Method.toServer(lightning, {
  async request({ request }) {
    const result = await createInvoice(request.amount)
    return { ...request, invoice: result.invoice, paymentHash: result.hash }
  },
  async verify({ credential }) {
    return Receipt.from({
      method: 'lightning',
      reference: credential.payload.preimage,
      status: 'success',
      timestamp: new Date().toISOString(),
    })
  },
})
```

#### Respond hook

Use `respond` to return a Response directly after verification, skipping the route handler. Return `undefined` to let the handler run normally.

```ts twoslash [methods.server.ts]
import { Method, Receipt, z } from 'mppx'

const lightning = Method.from({
  intent: 'charge',
  name: 'lightning',
  schema: {
    credential: { payload: z.object({ preimage: z.string() }) },
    request: z.object({ amount: z.string(), currency: z.string(), invoice: z.string(), paymentHash: z.string(), recipient: z.string() }),
  },
})
// ---cut---
const serverMethod = Method.toServer(lightning, {
  async verify({ credential }) {
    return Receipt.from({
      method: 'lightning',
      reference: credential.payload.preimage,
      status: 'success',
      timestamp: new Date().toISOString(),
    })
  },
  respond({ input }) {
    if (input.method === 'POST' && input.headers.get('content-length') === '0') {
      return new Response(null, { status: 204 })
    }
    return undefined
  },
})
```

## First-party SDK

When you want others to use your payment method, package it as a standalone npm module. Users install it and import your method the same way they use `tempo` or `stripe`—a single import gives them both `Mppx` and your method factory.

### Package structure

Organize your SDK with three export paths: root (shared schemas), `./client`, and `./server`. Start with a single intent (`charge`) and add more later.

```
my-method-sdk/
├── src/
│   ├── index.ts              # Re-export shared schemas
│   ├── Methods.ts            # Shared Method.from() definitions
│   ├── client/
│   │   ├── index.ts          # ./client entry point
│   │   └── Charge.ts         # Client charge implementation
│   └── server/
│       ├── index.ts          # ./server entry point
│       └── Charge.ts         # Server charge implementation
├── package.json
└── tsconfig.json
```

### Exports map

Define three entry points in `package.json`. Declare `mppx` as a peer dependency so the user's app shares a single instance.

```json [package.json]
{
  "name": "@my-org/my-method-sdk",
  "type": "module",
  "sideEffects": false,
  "files": ["dist", "src"],
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    },
    "./client": {
      "types": "./dist/client/index.d.ts",
      "default": "./dist/client/index.js"
    },
    "./server": {
      "types": "./dist/server/index.d.ts",
      "default": "./dist/server/index.js"
    }
  },
  "peerDependencies": {
    "mppx": ">=0.3.15"
  }
}
```

### Shared method definition

Define your schemas once in a shared file. Both client and server import from here.

```ts [src/Methods.ts]
import { Method, z } from 'mppx'

export const charge = Method.from({
  intent: 'charge',
  name: 'my-method',
  schema: {
    credential: {
      payload: z.object({ proof: z.string() }),
    },
    request: z.object({
      amount: z.string(),
      currency: z.string(),
      recipient: z.string(),
    }),
  },
})
```

### Re-export `Mppx`

Re-export `Mppx` (and `Expires`, `Store` on the server) from your entry points so users need only one import:

```ts [src/server/index.ts]
export { charge } from './Charge.js'
export { Mppx, Expires, Store } from 'mppx/server'
```

```ts [src/client/index.ts]
export { charge } from './Charge.js'
export { Mppx } from 'mppx/client'
```

Users get a single-line import:

```ts [server.ts]
import { Mppx, charge } from '@my-org/my-method-sdk/server'

const mppx = Mppx.create({
  methods: [charge({ /* config */ })],
})
```

### Advanced SDK patterns

#### Method namespace

When your SDK supports multiple intents, export a namespace that groups them under a single name. Calling the namespace directly defaults to `charge`.

```ts [src/server/Methods.ts]
import { charge as charge_ } from './Charge.js'
import { session as session_ } from './Session.js'

export function myMethod(parameters: myMethod.Parameters) {
  return myMethod.charge(parameters)
}

export namespace myMethod {
  export type Parameters = charge_.Parameters
  export const charge = charge_
  export const session = session_
}
```

```ts [server.ts]
import { myMethod } from '@my-org/my-method-sdk/server'

myMethod(opts)             // defaults to charge
myMethod.charge(opts)      // explicit charge
myMethod.session(opts)     // explicit session
```

#### Augment the returned method

Use `Object.assign` to attach lifecycle methods (like `cleanup` or `close`) to the method object returned by `Method.toClient` or `Method.toServer`:

```ts [src/client/Charge.ts]
import { Credential, Method } from 'mppx'
import * as Methods from '../Methods.js'

export function charge(parameters: charge.Parameters) {
  let connection: WebSocket | null = null

  const method = Method.toClient(Methods.charge, {
    async createCredential({ challenge }) {
      // ... pay and return credential
    },
  })

  async function cleanup() {
    connection?.close()
  }

  return Object.assign(method, { cleanup })
}
```

### Reference implementations

| SDK | Payment rail | Intents | Source |
|---|---|---|---|
| [`@buildonspark/lightning-mpp-sdk`](https://github.com/buildonspark/lightning-mpp-sdk) | Lightning Network | charge, session | [GitHub](https://github.com/buildonspark/lightning-mpp-sdk) |

## Gotchas

* **Always reject invalid proofs.** Throw an error from `verify` when verification fails. Never return a success Receipt without checking the proof.
* **Use decimal-safe math for amounts.** Use `parseUnits`/`formatUnits` from viem instead of `Number()` or floating-point arithmetic.
* **Verify against the original Challenge.** Always check the Credential's proof against the request fields from the Challenge (amount, currency, recipient). Don't trust the payload alone.
* **Keep secrets server-side.** The Challenge is sent to the client. Don't put API keys, private keys, or other secrets in request fields.
* **Use `methodDetails` for method-specific fields.** Nest non-standard request fields under a `methodDetails` object to avoid collisions with the base schema.
* **Make invoice/order creation idempotent.** The `request` hook runs on both the initial `402` and the Credential submission. Don't generate a new invoice if one already exists for the Challenge.
* **Clean up resources.** If your client method opens WebSocket connections, SDK instances, or listeners, expose a `cleanup()` method so callers can tear them down.

## SDK references

* [`Method.from`](/sdk/typescript/Method.from) — Define a payment method with schemas
* [`Method.toClient`](/sdk/typescript/core/Method.toClient) — Extend a method with client-side Credential creation logic
* [`Method.toServer`](/sdk/typescript/core/Method.toServer) — Extend a method with server-side verification logic

# Lightning \[Bitcoin payments over the Lightning Network]

The Lightning payment method enables payments using Bitcoin over the [Lightning Network](https://lightning.network) within the MPP framework. Lightning supports two intents—**charge** for one-time payments and **session** for prepaid metered access—covering everything from single API calls to high-frequency streaming billing.

The implementation is provided by [`@buildonspark/lightning-mpp-sdk`](https://github.com/buildonspark/lightning-mpp-sdk), which extends the [`mppx`](https://github.com/tempoxyz/mpp) SDK with Lightning Network support alongside built-in methods like [Stripe](/payment-methods/stripe) and [Tempo](/payment-methods/tempo). The reference implementation uses [Spark](https://spark.money) for wallet and node operations, but the protocol works with any Lightning node or wallet that can create BOLT11 invoices and verify preimages.

## Installation

:::code-group

```bash [npm]
npm install @buildonspark/lightning-mpp-sdk
```

```bash [pnpm]
pnpm add @buildonspark/lightning-mpp-sdk
```

```bash [bun]
bun add @buildonspark/lightning-mpp-sdk
```

:::

## Payments on Lightning

Lightning brings a distinct set of properties to MPP:

* **Cryptographic verification**—The server checks `sha256(preimage) == paymentHash` with a single hash operation. Verification is entirely local and self-contained.
* **Synchronous settlement**—Lightning HTLC settlement reveals the preimage atomically. The preimage *is* the proof of payment, available the instant the payment settles.
* **Global and permissionless**—Bitcoin works identically in every jurisdiction. Anyone can participate without accounts, approvals, or special routing.
* **Self-custodial**—Both client and server hold their own keys via Spark wallets. Funds stay under each party's control throughout the entire flow.

## Choosing an intent

| | **Charge** | **Session** |
|---|---|---|
| **Pattern** | One-time payment per request | Prepaid deposit, per-request billing |
| **Latency overhead** | One Lightning payment per request | Near-zero (bearer token after deposit) |
| **Throughput** | One invoice + payment per request | Hundreds of requests per session |
| **Best for** | Single API calls, content access, one-off purchases | LLM APIs, metered services, streaming |
| **Settlement** | Immediate per-request via HTLC | Deposit upfront, per-request deduction, refund on close |

## Intents

<div className="vocs:grid vocs:grid-cols-1 vocs:md:grid-cols-2 vocs:gap-4">
  <a href="/payment-methods/lightning/charge" className="vocs:relative vocs:flex vocs:flex-col vocs:space-y-2 vocs:rounded-md vocs:bg-surfaceTint/70 vocs:border vocs:border-primary vocs:p-4 vocs:no-underline vocs:transition-colors vocs:hover:bg-surfaceTint">
    <div className="vocs:size-8 vocs:flex vocs:items-center vocs:justify-center vocs:rounded-lg vocs:border vocs:border-primary vocs:bg-surface vocs:text-accent">
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
      </svg>
    </div>

    <div className="vocs:text-[15px] vocs:font-medium vocs:text-heading">Lightning charge</div>
    <div className="vocs:text-sm vocs:leading-relaxed vocs:text-secondary">One-time payments using BOLT11 invoices</div>
  </a>

  <a href="/payment-methods/lightning/session" className="vocs:relative vocs:flex vocs:flex-col vocs:space-y-2 vocs:rounded-md vocs:bg-surfaceTint/70 vocs:border vocs:border-primary vocs:p-4 vocs:no-underline vocs:transition-colors vocs:hover:bg-surfaceTint">
    <div className="vocs:size-8 vocs:flex vocs:items-center vocs:justify-center vocs:rounded-lg vocs:border vocs:border-primary vocs:bg-surface vocs:text-accent">
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />

        <path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />

        <path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
      </svg>
    </div>

    <div className="vocs:text-[15px] vocs:font-medium vocs:text-heading">Lightning session</div>
    <div className="vocs:text-sm vocs:leading-relaxed vocs:text-secondary">Prepaid metered access with per-request billing</div>
  </a>
</div>

# Solana \[Native SOL and SPL token payments]

The Solana payment method enables MPP payments on Solana using native SOL, SPL tokens, and Token-2022 assets. Solana supports two intents: **charge** for one-time payments and **session** for escrowed, pay-as-you-go billing.

The reference implementation is provided by [`@solana/mpp`](https://github.com/solana-foundation/mpp-sdk), which extends [`mppx`](https://github.com/tempoxyz/mpp) with Solana-native client and server handlers.

## Installation

:::code-group

```bash [npm]
npm install @solana/mpp mppx @solana/kit
```

```bash [pnpm]
pnpm add @solana/mpp mppx @solana/kit
```

```bash [bun]
bun add @solana/mpp mppx @solana/kit
```

:::

## Why Solana

Solana enables several useful capabilities for MPP:

* **Split payouts and richer settlement flows** through multiple instructions per transaction
* **Fast finality** for low-latency charge flows
* **Cheap transactions** for micropayments and fee-sponsored UX
* **Native fee payer support** so servers can sponsor network fees
* **Token flexibility** across SOL, SPL, and Token-2022 assets
* **Delegated signer options** including Ed25519 and passkey-friendly secp256r1 flows

## Choosing an intent

| | **Charge** | **Session** |
|---|---|---|
| **Pattern** | One-time payment per request | Escrow once, pay incrementally with vouchers |
| **Latency overhead** | One transaction or confirmed signature per request | Low after open; vouchers are off-chain |
| **Throughput** | Best for discrete purchases | Best for high-frequency metered usage |
| **Best for** | Paid API calls, downloads, fixed-price purchases | LLM APIs, streaming, repeated calls |
| **Settlement** | Immediate on-chain transfer | Escrow on-chain, settle accepted usage later |

## Intents

<div className="vocs:grid vocs:grid-cols-1 vocs:md:grid-cols-2 vocs:gap-4">
  <a href="/payment-methods/solana/charge" className="vocs:relative vocs:flex vocs:flex-col vocs:space-y-2 vocs:rounded-md vocs:bg-surfaceTint/70 vocs:border vocs:border-primary vocs:p-4 vocs:no-underline vocs:transition-colors vocs:hover:bg-surfaceTint">
    <div className="vocs:size-8 vocs:flex vocs:items-center vocs:justify-center vocs:rounded-lg vocs:border vocs:border-primary vocs:bg-surface vocs:text-accent">
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 397.7 311.7" fill="currentColor">
        <path d="M64.3 237.9c2.4-2.4 5.7-3.8 9.1-3.8h317.6c5.7 0 8.5 6.9 4.5 10.9l-62.7 62.7c-2.4 2.4-5.7 3.8-9.1 3.8H6.1c-5.7 0-8.5-6.9-4.5-10.9l62.7-62.7ZM64.3 3.8C66.7 1.4 70 0 73.4 0H391c5.7 0 8.5 6.9 4.5 10.9l-62.7 62.7c-2.4 2.4-5.7 3.8-9.1 3.8H6.1c-5.7 0-8.5-6.9-4.5-10.9L64.3 3.8Zm268.5 116.2c-2.4-2.4-5.7-3.8-9.1-3.8H6.1c-5.7 0-8.5 6.9-4.5 10.9l62.7 62.7c2.4 2.4 5.7 3.8 9.1 3.8h317.6c5.7 0 8.5-6.9 4.5-10.9L332.8 120Z" />
      </svg>
    </div>

    <div className="vocs:text-[15px] vocs:font-medium vocs:text-heading">Solana charge</div>
    <div className="vocs:text-sm vocs:leading-relaxed vocs:text-secondary">One-time payments with signed transactions or confirmed signatures</div>
  </a>

  <a href="https://github.com/tempoxyz/mpp-specs/pull/201" className="vocs:relative vocs:flex vocs:flex-col vocs:space-y-2 vocs:rounded-md vocs:bg-surfaceTint/70 vocs:border vocs:border-primary vocs:p-4 vocs:no-underline vocs:transition-colors vocs:hover:bg-surfaceTint">
    <div className="vocs:size-8 vocs:flex vocs:items-center vocs:justify-center vocs:rounded-lg vocs:border vocs:border-primary vocs:bg-surface vocs:text-accent">
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 397.7 311.7" fill="currentColor">
        <path d="M64.3 237.9c2.4-2.4 5.7-3.8 9.1-3.8h317.6c5.7 0 8.5 6.9 4.5 10.9l-62.7 62.7c-2.4 2.4-5.7 3.8-9.1 3.8H6.1c-5.7 0-8.5-6.9-4.5-10.9l62.7-62.7ZM64.3 3.8C66.7 1.4 70 0 73.4 0H391c5.7 0 8.5 6.9 4.5 10.9l-62.7 62.7c-2.4 2.4-5.7 3.8-9.1 3.8H6.1c-5.7 0-8.5-6.9-4.5-10.9L64.3 3.8Zm268.5 116.2c-2.4-2.4-5.7-3.8-9.1-3.8H6.1c-5.7 0-8.5 6.9-4.5 10.9l62.7 62.7c2.4 2.4 5.7 3.8 9.1 3.8h317.6c5.7 0 8.5-6.9 4.5-10.9L332.8 120Z" />
      </svg>
    </div>

    <div className="vocs:text-[15px] vocs:font-medium vocs:text-heading">Solana session</div>
    <div className="vocs:text-sm vocs:leading-relaxed vocs:text-secondary">Coming soon: Solana sessions with off-chain vouchers and on-chain settlement</div>
  </a>
</div>

# Stripe \[Cards, wallets, and other Stripe supported payment methods]

The Stripe payment method enables payments using [Shared Payment Tokens (SPTs)](https://docs.stripe.com/agentic-commerce/concepts/shared-payment-tokens)—tokens that allow a client to share a customer's payment method with your Stripe account, with configurable expiration and usage limits. SPTs provide you basic visibility into the payment method (such as card brand and last four digits), while keeping the customer's actual payment details separate.

Both the client and server need a Stripe account. The client creates an SPT using the Stripe API or Stripe.js, and the server consumes it to create a Stripe `PaymentIntent`.

::::info\[Stripe account setup]
Machine payments must be enabled on your Stripe account before you can accept MPP payments. [Request access](https://docs.stripe.com/payments/machine#sign-up) through the Stripe Dashboard.
::::

To learn more, read the [Stripe documentation](https://docs.stripe.com/payments/machine/mpp) on accepting MPP.

## How it works

<MermaidDiagram
  chart={`sequenceDiagram
  participant Client
  participant Server
  participant Stripe
  Client->>Server: (1) GET /resource
  Server-->>Client: (2) 402 + Challenge
  Client->>Stripe: (3) Create SPT from Challenge
  Stripe-->>Client: (4) spt_...
  Client->>Server: (5) GET /resource + Credential
  Server->>Stripe: (6) Create PaymentIntent (using SPT)
  Stripe-->>Server: (7) pi_...
  Server-->>Client: (8) 200 OK + Receipt
`}
/>

1. **Server** responds with `402` and a Challenge containing the amount, currency, and Stripe method details (Business Network profile, allowed payment method types).
2. **Client** collects a payment method (via Stripe Elements or a stored method), then creates an SPT through the Stripe API with usage limits matching the Challenge.
3. **Client** sends a Credential containing the SPT.
4. **Server** creates a Stripe `PaymentIntent` using the SPT and confirms it.
5. **Server** returns the resource with a Receipt referencing the `PaymentIntent`.

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

<div className="vocs:grid vocs:grid-cols-1 vocs:md:grid-cols-2 vocs:gap-4">
  <a href="/payment-methods/tempo/charge" className="vocs:relative vocs:flex vocs:flex-col vocs:space-y-2 vocs:rounded-md vocs:bg-surfaceTint/70 vocs:border vocs:border-primary vocs:p-4 vocs:no-underline vocs:transition-colors vocs:hover:bg-surfaceTint">
    <div className="vocs:size-8 vocs:flex vocs:items-center vocs:justify-center vocs:rounded-lg vocs:border vocs:border-primary vocs:bg-surface vocs:text-accent">
      <svg viewBox="0 0 24 24" width="20" height="20">
        <path fill="currentColor" d="M10.55 17h-2.73l2.53-7.73h-3.24l.71-2.27h9.03l-.71 2.27h-3.07L10.55 17Z" />
      </svg>
    </div>

    <div className="vocs:text-[15px] vocs:font-medium vocs:text-heading">Tempo charge</div>
    <div className="vocs:text-sm vocs:leading-relaxed vocs:text-secondary">Immediate one-time payments settled on-chain</div>
  </a>

  <a href="/payment-methods/tempo/session" className="vocs:relative vocs:flex vocs:flex-col vocs:space-y-2 vocs:rounded-md vocs:bg-surfaceTint/70 vocs:border vocs:border-primary vocs:p-4 vocs:no-underline vocs:transition-colors vocs:hover:bg-surfaceTint">
    <div className="vocs:absolute vocs:top-4 vocs:right-4"><Badge variant="info">Recommended</Badge></div>

    <div className="vocs:size-8 vocs:flex vocs:items-center vocs:justify-center vocs:rounded-lg vocs:border vocs:border-primary vocs:bg-surface vocs:text-accent">
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />

        <path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />

        <path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
      </svg>
    </div>

    <div className="vocs:text-[15px] vocs:font-medium vocs:text-heading">Session</div>
    <div className="vocs:text-sm vocs:leading-relaxed vocs:text-secondary">Pay-as-you-go payment sessions over payment channels</div>
  </a>
</div>

## Fee sponsorship

Tempo supports server-paid transaction fees for both charge and session intents. When enabled, the client signs only the payment authorization and the server covers gas costs. The client doesn't need to hold gas tokens or understand fee mechanics.

Pass a `feePayer` account to `tempo()` to enable this:

```ts twoslash
import { Mppx, tempo } from 'mppx/server'
import { privateKeyToAccount } from 'viem/accounts'

const mppx = Mppx.create({
  methods: [tempo({
    feePayer: privateKeyToAccount('0x…'), // [!code hl]
  })],
})
```

It is also possible to point the `feePayer` to a fee service that supports the [`Handler.feePayer`](https://docs.tempo.xyz/sdk/typescript/server/handler.feePayer) endpoint:

```ts
import { Mppx, tempo } from 'mppx/server'

const mppx = Mppx.create({
  methods: [tempo({
    feePayer: 'https://sponsor.example.com', // [!code hl]
  })],
})
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
| `intent` | Payment intent type (such as `charge` or `session`) |
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
  "recipient": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
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
  <SpecCard to="https://paymentauth.org" />

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
  <SpecCard to="https://paymentauth.org" />

  <PaymentMethodsCard />
</Cards>

# Discovery \[Advertise your service's payment terms]

MPPs discovery system lets clients learn what your endpoints cost before making a request. You serve a standard [OpenAPI 3.1](https://spec.openapis.org/oas/v3.1.0) document at `/openapi.json` with `x-payment-info` extensions on each paid operation.

:::info\[IETF Specification]
This page is a developer-friendly overview. For the full normative spec, see [draft-payment-discovery-00](https://paymentauth.org/draft-payment-discovery-00.html) on [paymentauth.org](https://paymentauth.org).
:::

## How it works

Your server exposes a `GET /openapi.json` endpoint that returns an OpenAPI document. Paid operations include an `x-payment-info` extension with the payment terms, and the document root can include `x-service-info` for service-level metadata.

```json [/openapi.json]
{
  "openapi": "3.1.0",
  "info": { "title": "My API", "version": "1.0.0" },
  "x-service-info": {
    "categories": ["ai"],
    "docs": {
      "homepage": "https://example.com",
      "apiReference": "https://example.com/docs",
      "llms": "/llms.txt"
    }
  },
  "paths": {
    "/v1/generate": {
      "post": {
        "x-payment-info": { // [!code highlight]
          "amount": "1000000", // [!code highlight]
          "currency": "0x20c0000000000000000000000000000000000001", // [!code highlight]
          "description": "Generate text", // [!code highlight]
          "intent": "charge", // [!code highlight]
          "method": "tempo" // [!code highlight]
        }, // [!code highlight]
        "responses": {
          "200": { "description": "Successful response" },
          "402": { "description": "Payment Required" }
        }
      }
    },
    "/v1/models": {
      "get": {
        "responses": {
          "200": { "description": "Successful response" }
        }
      }
    }
  }
}
```

:::info\[Discovery is advisory]
Discovery documents are informational hints. The runtime `402` Challenge remains the authoritative source of payment terms. Clients use discovery for display and planning, but defer to the Challenge for actual payment.
:::

### `x-payment-info`

Added to any operation that requires payment:

| Field | Type | Description |
|-------|------|-------------|
| `amount` | `string` | Payment amount in base units |
| `currency` | `string` | Currency code or token address |
| `description` | `string` | Human-readable description of the charge |
| `intent` | `string` | Payment intent (`charge` or `session`) |
| `method` | `string` | Payment method identifier (`tempo`, `stripe`) |

### `x-service-info`

Optional root-level metadata about the service:

| Field | Type | Description |
|-------|------|-------------|
| `categories` | `string[]` | Free-form service categories (for example, `ai`, `payments`) |
| `docs.homepage` | `string` | Link to the service homepage |
| `docs.apiReference` | `string` | Link to API documentation |
| `docs.llms` | `string` | Link to an `llms.txt` file for AI consumption |

## Generate with `mppx`

The `mppx` SDK generates discovery documents from your route configuration. Each framework integration includes a `discovery()` helper.

### Hono

Hono supports automatic route introspection. Set `auto: true` and `mppx` reads payment metadata directly from your registered routes.

```ts [server.ts]
import { Hono } from 'hono'
import { Mppx, discovery } from 'mppx/hono'
import { tempo } from 'mppx/server'

const app = new Hono()

const mppx = Mppx.create({
  methods: [
    tempo({ // [!code hl]
      currency: '0x20c0000000000000000000000000000000000000', // [!code hl]
      recipient: '0x...', // [!code hl]
      testnet: true, // [!code hl]
    }), // [!code hl]
  ],
  secretKey: process.env.MPP_SECRET_KEY,
})

app.get('/v1/fortune', mppx.charge({ amount: '0.01' }), (c) => c.json({ fortune: 'You will be rich' }))

discovery(app, mppx, { // [!code hl]
  auto: true, // [!code hl]
  info: { title: 'Fortune API', version: '1.0.0' }, // [!code hl]
}) // [!code hl]
```

### Express

```ts [server.ts]
import express from 'express'
import { Mppx, discovery } from 'mppx/express'
import { tempo } from 'mppx/server'

const app = express()

const mppx = Mppx.create({
  methods: [
    tempo({
      currency: '0x20c0000000000000000000000000000000000000',
      recipient: '0x...',
      testnet: true,
    }),
  ],
  secretKey: process.env.MPP_SECRET_KEY,
})

const pay = mppx.charge({ amount: '0.01' })
app.get('/v1/fortune', pay, (req, res) => res.json({ fortune: 'You will be rich' }))

discovery(app, mppx, { // [!code hl]
  info: { title: 'Fortune API', version: '1.0.0' }, // [!code hl]
  routes: [{ handler: pay, method: 'get', path: '/v1/fortune' }], // [!code hl]
}) // [!code hl]
```

### Next.js

In Next.js, `discovery()` returns a route handler you export from an API route.

```ts [app/openapi.json/route.ts]
import { discovery } from 'mppx/nextjs'
import { mppx, pay } from '../fortune/route'

export const GET = discovery(mppx, { // [!code hl]
  info: { title: 'Fortune API', version: '1.0.0' }, // [!code hl]
  routes: [{ handler: pay, method: 'get', path: '/api/fortune' }], // [!code hl]
}) // [!code hl]
```

### CLI

Generate a static discovery document from a config module:

```bash [terminal]
$ npx mppx discover generate ./discovery.config.ts
```

Validate an existing discovery document from a file or URL:

```bash [terminal]
$ npx mppx discover validate https://example.com/openapi.json
```

## Build manually

You can author a discovery document by hand following the [discovery specification](https://paymentauth.org/draft-payment-discovery-00.html). The document is a standard OpenAPI 3.1 file with two extensions:

::::steps

#### Create the OpenAPI skeleton

Start with a standard OpenAPI 3.1 document:

```json [openapi.json]
{
  "openapi": "3.1.0",
  "info": {
    "title": "My API",
    "version": "1.0.0"
  },
  "paths": {}
}
```

#### Add `x-payment-info` to paid operations

For each endpoint that requires payment, add the `x-payment-info` extension. Amounts are in base units (for example, `1000000` for $1.00 with 6 decimals).

```json [openapi.json]
{
  "paths": {
    "/v1/generate": {
      "post": {
        "summary": "Generate text",
        "x-payment-info": { // [!code highlight]
          "amount": "1000000", // [!code highlight]
          "currency": "0x20c0000000000000000000000000000000000001", // [!code highlight]
          "intent": "charge", // [!code highlight]
          "method": "tempo" // [!code highlight]
        }, // [!code highlight]
        "responses": {
          "200": { "description": "Successful response" },
          "402": { "description": "Payment Required" }
        }
      }
    }
  }
}
```

:::warning\[Include a 402 response]
Operations with `x-payment-info` must include a `402` response in the `responses` object. Validators flag this as an error if missing.
:::

#### Add `x-service-info` (optional)

Add service-level metadata to the document root:

```json [openapi.json]
{
  "x-service-info": { // [!code highlight]
    "categories": ["ai", "text-generation"], // [!code highlight]
    "docs": { // [!code highlight]
      "homepage": "https://example.com", // [!code highlight]
      "apiReference": "https://example.com/docs/api", // [!code highlight]
      "llms": "https://example.com/llms.txt" // [!code highlight]
    } // [!code highlight]
  } // [!code highlight]
}
```

#### Serve at `/openapi.json`

Serve the document at `GET /openapi.json` with appropriate caching:

```http
HTTP/1.1 200 OK
Content-Type: application/json
Cache-Control: public, max-age=300
```

::::

## Registries

Registries aggregate discovery documents from multiple services, making it easy for clients and agents to find paid APIs.

| Registry | Description |
|----------|-------------|
| [MPPScan](https://mppscan.com) | Public registry of MPP-enabled services with search and analytics |
| [MPP Services directory](https://mpp.dev/services) | Curated list of live services on mpp.dev |

## Validation

Use the `mppx` CLI to validate discovery documents before deploying:

```bash [terminal]
# Validate a remote endpoint
$ npx mppx discover validate https://your-api.com/openapi.json

# Validate a local file
$ npx mppx discover validate ./openapi.json
```

Common validation issues:

| Issue | Severity | Description |
|-------|----------|-------------|
| Missing `402` response | Error | Operations with `x-payment-info` must include a `402` response |
| Invalid amount format | Error | `amount` must be a non-negative integer string |
| Missing `requestBody` | Warning | `POST`/`PUT`/`PATCH` operations without a `requestBody` definition |
| Invalid URI in docs | Error | `docs` links must be valid URIs or absolute paths |

# HTTP 402 payment required \[The status code that signals payment is required]

MPP services return HTTP `402` Payment Required to indicate that a resource requires payment for access.

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
  <SpecCard to="https://paymentauth.org" />
</Cards>

# Receipts \[Server acknowledgment of successful payment]

A **Receipt** is the server's acknowledgment of successful payment. Return receipts in the `Payment-Receipt` header on successful responses.

:::info
The `Payment-Receipt` header is optional. Servers typically include it for auditability, but clients don't need it for correct operation.
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
  <SpecCard to="https://paymentauth.org" />
</Cards>

# Transports \[HTTP and MCP bindings for payment flows]

MPP defines how the Payment authentication scheme operates over different transport protocols. The core protocol targets HTTP, with extensions for other transports like MCP and JSON-RPC.

## Available transports

| Transport | Use Case | Spec |
|-----------|----------|------|
| [HTTP](/protocol/transports/http) | REST APIs, web resources | [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110#section-11) |
| [MCP](/protocol/transports/mcp) | AI tool calls using Model Context Protocol | [MCP Transport Spec](https://paymentauth.org) |
| JSON-RPC | Non-MCP JSON-RPC services | [JSON-RPC 2.0](https://www.jsonrpc.org/specification) |

## Transport-agnostic design

MPP's core concepts—Challenges, Credentials, and Receipts—remain the same across transports. The encoding and delivery mechanism changes:

* **HTTP** uses standard headers (`WWW-Authenticate`, `Authorization`, `Payment-Receipt`)
* **MCP** uses JSON-RPC error codes and `_meta` fields

Choose the transport that matches your protocol. HTTP for REST APIs, MCP for AI agent tool calls, or JSON-RPC for non-MCP JSON-RPC services.

# Use with agents \[Connect your agent to MPP-enabled services]

Agents can automatically interact with MPP-enabled services. Here's how to get started.

## Tempo Wallet <Badge variant="info" data-toc-exclude>Recommended</Badge>

The [Tempo Wallet](https://wallet.tempo.xyz) is a managed MPP client with built in spend controls and service discovery. Agents can use `tempo wallet` to pay for powerful new capabilities on demand.

<Tabs>
  <Tab title="Agent">
    Paste this into your agent to set up Tempo Wallet:

    ```
    Read https://tempo.xyz/SKILL.md and set up tempo
    ```
  </Tab>

  <Tab title="Human">
    ::::steps

    #### Install the CLI

    ```bash
    curl -fsSL https://tempo.xyz/install | bash
    ```

    #### Connect your wallet

    ```bash
    tempo wallet login
    ```

    #### Verify setup

    ```bash
    tempo wallet whoami
    ```

    #### List available services

    ```bash
    tempo wallet services
    ```

    #### Make a paid request

    ```bash
    tempo request -X POST \
      --json '{"prompt": "a sunset over the ocean"}' \
      https://fal.mpp.tempo.xyz/fal-ai/flux/dev
    ```

    ::::
  </Tab>
</Tabs>

## mppx

The [`mppx`](/sdk/typescript/cli) CLI is a lightweight MPP client bundled with the `mppx` package. It is designed for simple use cases and debugging during development.

::::steps

### Install

:::code-group

```bash [npm]
npm install -g mppx
```

```bash [pnpm]
pnpm add -g mppx
```

```bash [bun]
bun add -g mppx
```

:::

### Create an account

```bash
mppx account create
```

### Make a paid request

```bash
mppx https://mpp.dev/api/ping/paid
```

::::

## Next steps

<Cards>
  <Card description="Browse available MPP services and their endpoints" icon="lucide:list" title="Services" to="/services" />
</Cards>

# Use with your app \[Handle payment-gated resources automatically]

## Overview

Polyfill the global `fetch` to handle `402` responses. Your existing code works unchanged—payments happen in the background. Pick the path that suits you:

* [**Prompt mode**](#prompt-mode): paste a prompt into your coding agent for fast setup
* [**Manual mode**](#manual-mode): step-by-step setup with `mppx/client`

## Prompt mode

Paste this into your coding agent to set up your client with `mppx` in one prompt:

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
import { createConfig, http } from 'wagmi'
import { getConnectorClient } from 'wagmi/actions'
import { tempoModerato } from 'viem/chains'
import { Mppx, tempo } from 'mppx/client'

declare const connectors: Parameters<typeof createConfig>[0]['connectors']
// ---cut---
const config = createConfig({
  connectors,
  chains: [tempoModerato],
  transports: {
    [tempoModerato.id]: http(),
  },
})

Mppx.create({
  methods: [tempo({
    getClient: (parameters) =>
      getConnectorClient(config, parameters as any),
  })],
})
```

```ts twoslash [config.ts]
import { createConfig, http } from 'wagmi'
import { webAuthn, KeyManager } from 'wagmi/tempo'
import { tempoModerato } from 'viem/chains'

declare const keyManager: KeyManager.KeyManager
// ---cut---
export const config = createConfig({
  connectors: [webAuthn({ keyManager })],
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

  <MppxCreateReferenceCard to="/sdk/typescript/client/Mppx.create" />
</Cards>

# Add payments to your API \[Charge for access to protected resources]

## Overview

This quickstart demonstrates how to plug MPP into any server framework to accept payments for protected resources. Pick the path that suits you:

* [**Prompt mode**](#prompt-mode): paste a prompt into your coding agent and build in one prompt
* [**Framework mode**](#framework-mode): use `mppx` middleware for Next.js, Hono, Elysia, or Express
* [**Manual mode**](#advanced-manual-mode): call `mppx/server` directly with the Fetch API

## Prompt mode

Paste this into your coding agent to set up a server with `mppx` in one prompt:

<ServerPrompt />

## Framework mode

Use the framework-specific middleware from `mppx` to integrate payment into your server. Each middleware handles the `402` Challenge/Credential flow and attaches receipts automatically.

::::code-group

```ts [Next.js]
import { Mppx, tempo } from 'mppx/nextjs'

// [!code hl:start]
const mppx = Mppx.create({
  methods: [tempo({
    currency: '0x20c0000000000000000000000000000000000000', // pathUSD on Tempo
    recipient: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
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
    recipient: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
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
    recipient: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
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
    recipient: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
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
Don't see your framework? `mppx` is designed to be framework-agnostic. See [Manual mode](#advanced-manual-mode) below.
:::

## Advanced: manual mode

If you prefer full control over the payment flow, use `mppx/server` directly with the Fetch API.

```ts
import { Mppx, tempo } from 'mppx/server'

const mppx = Mppx.create({
  methods: [tempo({
    currency: '0x20c0000000000000000000000000000000000000',
    recipient: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
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
    recipient: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
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

## Push & pull modes

Tempo charges support two transaction submission modes, determined by the client:

* **`pull` mode (default)**: the client signs the transaction and sends the serialized transaction to the server. The server broadcasts it and verifies on-chain. This enables the server to sponsor gas fees via a `feePayer`.
* **`push` mode**: the client builds, signs, and broadcasts the transaction itself (for example, via a browser wallet). It sends the transaction hash to the server, which verifies the payment by fetching the receipt.

Your server handles both modes automatically—no configuration required. The server inspects the credential payload type (`transaction` for pull, `hash` for push) and verifies accordingly.

If you would like to force a specific mode, you can set the `mode` parameter to `'pull'` or `'push'`.

```ts
import { Mppx, tempo } from 'mppx/server'

const mppx = Mppx.create({
  methods: [tempo({
    currency: '0x20c0000000000000000000000000000000000000',
    mode: 'push', // [!code focus]
    recipient: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
  })],
})
```

### Fee sponsorship

To sponsor gas fees for pull-mode clients, pass a `feePayer` account to `tempo()`:

```ts
import { Mppx, tempo } from 'mppx/server'
import { privateKeyToAccount } from 'viem/accounts'

const mppx = Mppx.create({
  methods: [tempo({
    currency: '0x20c0000000000000000000000000000000000000',
    feePayer: privateKeyToAccount('0x…'), // [!code focus]
    recipient: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
  })],
})
```

It is possible to pass a [fee payer service](https://docs.tempo.xyz/sdk/typescript/server/handler.feePayer) URL instead:

```ts
import { Mppx, tempo } from 'mppx/server'

const mppx = Mppx.create({
  methods: [tempo({
    currency: '0x20c0000000000000000000000000000000000000',
    feePayer: 'https://sponsor.example.com', // [!code focus]
    recipient: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
  })],
})
```

When a pull-mode client submits a signed transaction, the server co-signs with the fee payer account (or delegates to the relay) before broadcasting. Push-mode clients pay their own gas, so `feePayer` is ignored for those requests.

### Optimistic verification

By default, the server waits for onchain confirmation before returning a Receipt. For lower latency, set `waitForConfirmation: false` to return immediately after simulation:

```ts
const mppx = Mppx.create({
  methods: [tempo({
    currency: '0x20c0000000000000000000000000000000000000',
    recipient: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
    waitForConfirmation: false, // [!code focus]
  })],
})
```

:::warning
Optimistic verification simulates the transaction but does not wait for inclusion. If the transaction reverts onchain after broadcast, the Receipt does not reflect the failure. Only use this when latency matters more than guaranteed confirmation.
:::

## Testing your server

After your server is running, test it with the `mppx` CLI:

```bash
# Create an account funded with testnet tokens
$ npx mppx account create

# Make a paid request
$ npx mppx <your-server>/resource
```

:::tip
Use `npx mppx --inspect` to debug your server's Challenge response without making any payments.
:::

## Next steps

<Cards>
  <ClientQuickstartCard />

  <MppxCreateReferenceCard to="/sdk/typescript/server/Mppx.create" />
</Cards>

# SDK features \[Parity across TypeScript, Python, and Rust]

This page tracks which features are implemented in each official SDK.

## Core

| Component | [TypeScript](https://github.com/wevm/mppx) | [Rust](https://github.com/tempoxyz/mpp-rs) | [Python](https://github.com/tempoxyz/pympp) |
|---|---|---|---|
| Client | ✓ | ✓ | ✓ |
| Server | ✓ | ✓ | ✓ |
| Proxy | ✓ | ✓ | — |

## Payment methods

| Method | TypeScript | Rust | Python |
|---|---|---|---|
| [Tempo](/payment-methods/tempo) | ✓ | ✓ | ✓ |
| [Stripe](/payment-methods/stripe) | ✓ | — | — |

Additional payment methods implement their own SDKs. Refer to the maintaining organizations for support and availability.

## Intents

| Intent | TypeScript | Rust | Python |
|---|---|---|---|
| [Charge](/intents/charge) | ✓ | ✓ | ✓ |
| [Session](/payment-methods/tempo/session) | ✓ | ✓ | — |

## Transports

| Transport | TypeScript | Rust | Python |
|---|---|---|---|
| [HTTP](/protocol/transports/http) | ✓ | ✓ | ✓ |
| [MCP](/protocol/transports/mcp) | ✓ | ✓ | ✓ |

### HTTP framework integrations

| Role | TypeScript | Rust | Python |
|---|---|---|---|
| **Client** | fetch | reqwest | httpx |
| **Server** | Elysia, Express, Hono, Next.js | Axum, Tower | Decorator (`@server.pay`) |

### MCP framework integrations

| Role | TypeScript | Rust | Python |
|---|---|---|---|
| **Client** | MCP SDK transport | — | MCP SDK transport |
| **Server** | MCP SDK transport | — | FastMCP (`@pay` decorator) |

## Tempo features

| Feature | TypeScript | Rust | Python |
|---|---|---|---|
| Charge verification (server) | ✓ | ✓ | ✓ |
| Credential creation (client) | ✓ | ✓ | ✓ |
| `transaction` payload type | ✓ | ✓ | ✓ |
| `hash` payload type | ✓ | ✓ | ✓ |
| Fee payer co-signing | ✓ | ✓ | ✓ |
| Session channels (open/voucher/topUp/close) | ✓ | ✓ | — |
| SSE metered streaming | ✓ | ✓ | — |
| Attribution memo | ✓ | ✓ | ✓ |

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
        recipient="0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
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

## Requirements

* Rust 1.75+
* `reqwest` for HTTP requests
* `alloy` for Tempo signing (with the `tempo` feature)

## Quick start

### Server

```rust
use mpp::server::{Mpp, tempo, TempoConfig};
use mpp::{parse_authorization, format_www_authenticate};

let mpp = Mpp::create(tempo(TempoConfig {
    recipient: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
}))?;

// Generate a Challenge for $0.50
let challenge = mpp.charge("0.50")?;
let header = format_www_authenticate(&challenge)?;
// → respond with 402 + WWW-Authenticate header

// Later, verify the Credential from the retry request
let credential = parse_authorization(auth_header)?;
let receipt = mpp.verify_credential(&credential).await?;
// → respond with 200 + paid content
```

### Client

```rust
use mpp::client::{Fetch, TempoProvider};
use mpp::PrivateKeySigner;

let signer: PrivateKeySigner = "0xac0974bec..."
    .parse()?;
let provider = TempoProvider::new(signer, "https://rpc.tempo.xyz")?;

// Handles 402 automatically — pay and retry
let response = reqwest::Client::new()
    .get("https://api.example.com/paid")
    .send_with_payment(&provider)
    .await?;
```

## Feature flags

| Feature | Description |
|---------|-------------|
| `client` | Client-side providers, `Fetch` extension trait |
| `evm` | Shared EVM utilities (Address, U256, signing) |
| `middleware` | reqwest-middleware integration (implies `client`) |
| `server` | Server verification, `ChargeMethod` trait |
| `tempo` | Tempo blockchain support (includes `evm`) |

### Common combinations

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

* [Core types](/sdk/rust/core): Challenge, Credential, and Receipt primitives
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

      ```ts twoslash [fetch-resource.ts]
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
          recipient: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
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
          recipient: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
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
          recipient: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
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
          recipient: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
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

      ```ts twoslash
      import { Mppx, tempo } from 'mppx/server'

      const mppx = Mppx.create({
        methods: [tempo({
          currency: '0x20c0000000000000000000000000000000000000',
          recipient: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
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
          recipient: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
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
      $ bunx mppx account create
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
      $ bunx mppx https://mpp.dev/api/ping/paid
      ```

      :::

      ::::
    </div>
  </Tab>
</Tabs>

# Card charge \[One-time payments using encrypted network tokens]

The card implementation of the [charge](/intents/charge) intent.

The client obtains an encrypted network token from a credential issuer and sends it as a Credential. The server decrypts the token and charges the card through existing card network rails.

This method is best for single API calls, content access, or one-off purchases.

## Server

Use `MppCard.create` and `mpp.charge` to gate any endpoint behind a one-time card payment. The method handles Challenge generation, Credential decryption, gateway authorization, and Receipt generation.

```ts
import { MppCard } from 'mpp-card/server'

const mpp = MppCard.create({
  acceptedNetworks: ['visa'],
  merchantName: 'Demo',
  privateKey: process.env.PRIVATE_KEY,
  secretKey: process.env.MPP_SECRET_KEY,
  gateway: {
    async charge({ token, amount, currency, idempotencyKey }) {
      // Call your payment processor here
      return { reference: 'txn_123', status: 'success' }
    },
  },
})

const charge = mpp.charge({ amount: '500', currency: 'usd' })

export async function handler(request: Request) {
  const result = await charge(request)
  if (result.status === 402) return result.challenge
  return result.withReceipt(Response.json({ data: '...' }))
}
```

### Server parameters

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `acceptedNetworks` | `string[]` | Required | Accepted card networks |
| `merchantName` | `string` | Required | Display name shown to cardholder |
| `secretKey` | `string` | Required | HMAC signing key for challenge integrity |
| `gateway` | `ServerEnabler` | Required | Payment gateway for charging decrypted tokens |
| `privateKey` | `string` | Required | RSA-2048 PEM for token decryption |
| `billingRequired` | `boolean` | Optional | Request billing address from client |

## Client

Use `MppCard.create` to automatically handle `402` responses. The client parses the Challenge, requests an encrypted network token from the credential issuer, and retries with the Credential.

Before making payments, enroll a card through a tokenization provider (e.g., a secure card collection form or vault API) to obtain a `cardId`.

```ts
import { MppCard } from 'mpp-card/client'

MppCard.create({
  cardId: 'card_abc123',
  enabler: {
    async getPaymentData({ cardId, challenge }) {
      // Call your credential issuer here
      return { encryptedPayload: '...', network: 'visa' }
    },
  },
})

// Global fetch now handles 402 automatically
const res = await fetch('https://api.merchant.com/data')
```

### Without polyfill

If you don't want to patch `globalThis.fetch`, use `mppCard.fetch` directly:

```ts
import { MppCard } from 'mpp-card/client'

const mppCard = MppCard.create({
  cardId: 'card_abc123',
  polyfill: false,
})

const res = await mppCard.fetch('https://api.example.com/resource')
```

### Client parameters

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `cardId` | `string` | Required | Card identifier from your tokenization provider |
| `enabler` | `ClientEnabler` | Required | Credential issuer for token provisioning |

## Request fields

The Challenge request includes the base charge fields plus card method details.

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `amount` | `string` | Required | Amount in the smallest currency unit |
| `currency` | `string` | Required | ISO currency code |
| `description` | `string` | Optional | Human-readable payment description |
| `recipient` | `string` | Optional | Merchant identifier |
| `externalId` | `string` | Optional | Merchant reference ID |
| `methodDetails.acceptedNetworks` | `string[]` | Required | Accepted card networks |
| `methodDetails.merchantName` | `string` | Required | Display name shown to cardholder |
| `methodDetails.encryptionJwk` | `JWK` | Conditional | RSA-OAEP-256 public key for token encryption |
| `methodDetails.jwksUri` | `string` | Conditional | HTTPS URI to JWK Set |
| `methodDetails.kid` | `string` | Conditional | Key ID when `jwksUri` is used |
| `methodDetails.billingRequired` | `boolean` | Optional | Request billing address from client |

## Credential payload

The Credential payload contains the encrypted network token and card metadata.

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `encryptedPayload` | `string` | Required | JWE-encrypted network token (RSA-OAEP-256 + AES-256-GCM) |
| `network` | `string` | Required | Card network identifier |
| `panLastFour` | `string` | Required | Last four digits of card number |
| `panExpirationMonth` | `string` | Required | Card expiration month |
| `panExpirationYear` | `string` | Required | Card expiration year |
| `billingAddress` | `object` | Conditional | Billing address (present when `billingRequired` is set) |
| `cardholderFullName` | `string` | Optional | Cardholder name |
| `paymentAccountReference` | `string` | Conditional | Payment Account Reference from the token service provider |

## Specification

<Cards>
  <SpecCard to="https://paymentauth.org/draft-card-charge-00" />
</Cards>

# Lightning charge \[One-time payments using BOLT11 invoices]

The Lightning implementation of the [charge](/intents/charge) intent.

The server generates a fresh [BOLT11](https://github.com/lightning/bolts/blob/master/11-payment-encoding.md) invoice for each request. The client pays it over the [Lightning Network](https://lightning.network) and presents the payment preimage as a credential. The server verifies `sha256(preimage) == paymentHash` locally and returns the resource with a receipt.

This method is best for single API calls, content access, or one-off purchases.

## Server

The `spark` namespace is the reference implementation using [Spark](https://spark.money) wallets. The protocol works with any Lightning node—you can build your own method handler using [LND](https://github.com/lightningnetwork/lnd), [LDK](https://lightningdevkit.org), or any stack that can create BOLT11 invoices and verify preimages.

Use `spark.charge` to gate any endpoint behind a one-time Lightning payment. The method handles invoice generation, Challenge creation, preimage verification, and Receipt generation.

```ts
import { Mppx, spark } from '@buildonspark/lightning-mpp-sdk/server'

const mppx = Mppx.create({
  methods: [spark.charge({ mnemonic: process.env.MNEMONIC! })],
  secretKey: process.env.MPP_SECRET_KEY!,
})

export async function handler(request: Request) {
  const result = await mppx.charge({
    amount: '100',
    currency: 'BTC',
    description: 'Premium API access',
  })(request)

  if (result.status === 402) return result.challenge

  return result.withReceipt(Response.json({ data: '...' }))
}
```

### With expiry

```ts
import { Mppx, Expires, spark } from '@buildonspark/lightning-mpp-sdk/server'

const mppx = Mppx.create({
  methods: [spark.charge({ mnemonic: process.env.MNEMONIC! })],
  secretKey: process.env.MPP_SECRET_KEY!,
})

export async function handler(request: Request) {
  const result = await mppx.charge({
    amount: '100',
    currency: 'BTC',
    expires: Expires.minutes(10), // [!code hl]
  })(request)

  if (result.status === 402) return result.challenge
  return result.withReceipt(Response.json({ data: '...' }))
}
```

### With regtest

For local development and testing, set `network` to `'regtest'` and use the [Spark faucet](https://docs.spark.money/tools/faucet) to fund wallets.

```ts
import { Mppx, spark } from '@buildonspark/lightning-mpp-sdk/server'

const mppx = Mppx.create({
  methods: [spark.charge({
    mnemonic: process.env.MNEMONIC!,
    network: 'regtest', // [!code hl]
  })],
  secretKey: process.env.MPP_SECRET_KEY!,
})
```

### Server parameters

| Parameter | Type | Required | Default |
| --- | --- | --- | --- |
| `mnemonic` | `string` | Required | |
| `network` | `'mainnet'` | `'regtest'` | `'signet'` | Optional | `'mainnet'` |

## Client

Use `spark.charge` with `Mppx.create` to automatically handle `402` responses. The client parses the Challenge, pays the BOLT11 invoice, and retries with the preimage as a Credential.

```ts
import { Mppx, spark } from '@buildonspark/lightning-mpp-sdk/client'

Mppx.create({
  methods: [spark.charge({ mnemonic: process.env.MNEMONIC! })],
})

const response = await fetch('https://api.example.com/resource')
```

### Without polyfill

If you don't want to patch `globalThis.fetch`, use `mppx.fetch` directly:

```ts
import { Mppx, spark } from '@buildonspark/lightning-mpp-sdk/client'

const method = spark.charge({ mnemonic: process.env.MNEMONIC! })

const mppx = Mppx.create({
  methods: [method],
  polyfill: false,
})

try {
  const response = await mppx.fetch('https://api.example.com/resource')
  console.log(await response.json())
} finally {
  await method.cleanup()
}
```

:::info
The Spark SDK maintains WebSocket connections for Lightning payments. Call `method.cleanup()` when done to close connections and allow the process to exit.
:::

### Client parameters

| Parameter | Type | Required | Default |
| --- | --- | --- | --- |
| `mnemonic` | `string` | Required | |
| `network` | `'mainnet'` | `'regtest'` | `'signet'` | Optional | `'mainnet'` |
| `maxFeeSats` | `number` | Optional | `100` |

## Request fields

The Challenge request includes the base charge fields plus Lightning method details.

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `amount` | `string` | Required | Invoice amount in satoshis |
| `currency` | `string` | Optional | Must be `'BTC'` if present. Defaults to `'BTC'` |
| `description` | `string` | Optional | Human-readable memo. Maps to the BOLT11 description field |
| `methodDetails.invoice` | `string` | Required | Full BOLT11-encoded payment request (`lnbc...`). Authoritative source for all payment parameters |
| `methodDetails.paymentHash` | `string` | Optional | SHA-256 hash of the preimage, lowercase hex. Convenience field—must match the hash decoded from `invoice` |
| `methodDetails.network` | `string` | Optional | `'mainnet'`, `'regtest'`, or `'signet'`. Convenience field—must match `invoice`'s human-readable prefix. Defaults to `'mainnet'` |

## Credential payload

The Credential payload contains the payment preimage revealed by Lightning HTLC settlement.

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `preimage` | `string` | Required | 32-byte payment preimage, lowercase hex (64 characters) |

## Verification

The server verifies payment with a single hash operation:

1. Decode the Credential and extract `preimage`.
2. Compute `sha256(hex_to_bytes(preimage))`.
3. Compare against the `paymentHash` from the original Challenge.
4. If equal, payment is verified. Return the resource with a Receipt.

The entire verification path is local and self-contained.

## Specification

<Cards>
  <SpecCard to="https://paymentauth.org/draft-lightning-charge-00" />
</Cards>

# Lightning session \[Pay-as-you-go payments over Lightning]

The `session` intent enables high-frequency, pay-as-you-go payments over the Lightning Network. Clients pay a deposit invoice upfront, then authenticate subsequent requests by presenting the payment preimage as a bearer token. The server tracks a running balance and deducts the configured cost per unit of service. When the session closes, the server refunds any unspent balance via the client's return invoice.

Payment sessions reduce payment verification to a single SHA-256 check, making it possible to meter and bill at the granularity of individual LLM tokens, API calls, or bytes transferred.

## Why sessions

A charge intent requires a full Lightning round-trip per request—invoice generation, HTLC routing, preimage reveal. That's fine for a single API call, but an LLM inference can generate hundreds of tokens over several seconds. Paying per token over Lightning would add seconds of latency per chunk.

Sessions fix this: one deposit, then the preimage becomes a bearer token. Every subsequent request is verified with a single `sha256` call, keeping the entire flow local and inline. The server deducts from the balance as it streams. When the client is done, the server refunds the unspent sats via the return invoice.

## How it works

### Overview

<MermaidDiagram
  chart={`sequenceDiagram
  participant Client
  participant Server
  participant LN as Lightning Network
  Client->>Server: (1) GET /generate
  Server->>LN: Create deposit invoice
  LN-->>Server: invoice + paymentHash
  Server-->>Client: 402 + deposit invoice
  Client->>LN: (2) Pay deposit invoice
  LN-->>Client: preimage
  Client->>Server: (3) GET /generate + open credential
  Note over Server: Verify preimage, store session
  Server-->>Client: 200 OK + SSE stream
  Client->>Server: (4) GET /generate + bearer credential
  Note over Server: Verify preimage, deduct per chunk
  Server-->>Client: 200 OK + SSE stream
  Client->>Server: (5) GET /generate + close credential
  Note over Server: Refund unspent via return invoice
  Server-->>Client: 200 {"status":"closed"}
`}
/>

A Lightning session has four phases:

::::steps

### Open

The client pays a deposit invoice over the Lightning Network. HTLC settlement reveals the payment preimage—a 32-byte random secret that becomes the bearer token for the session. The client submits the preimage along with a return invoice (a zero-amount BOLT11 invoice for refunds) to open the session.

### Session (bearer)

The client authenticates subsequent requests by presenting the preimage and session ID. The server verifies `sha256(preimage) == paymentHash` with a single hash operation, entirely locally. The streaming layer deducts the per-unit cost from the session balance for each chunk delivered.

### Top up

If the balance runs out mid-stream, the server emits a `payment-need-topup` SSE event and holds the connection open. The client pays a fresh deposit invoice and submits a `topUp` credential. The server credits the balance and resumes the stream on the original connection. The client doesn't need to replay the request.

### Close

The client submits a `close` credential. The server computes `refundSats = depositSats - spent` and pays the return invoice with the unspent balance. The session is marked closed and no further actions are accepted.

::::

## Streaming LLM billing

A typical flow for a streaming LLM API priced at 2 sats per token:

1. **Client:** sends an unauthenticated request to the API
2. **Server:** returns `402` with a deposit invoice for 300 sats (~150 tokens)
3. **Client:** pays the invoice, opens a session with the preimage + return invoice
4. **Server:** begins streaming tokens, deducting 2 sats per chunk from the session balance
5. **Server:** balance exhausted mid-stream—emits `payment-need-topup`, holds connection open
6. **Client:** pays a new deposit invoice, submits a `topUp` credential—stream resumes
7. **Client:** closes the session—server refunds unspent sats to the return invoice

Everything happens locally during streaming. Verification is a single SHA-256 hash per request, and billing is an integer decrement per chunk.

:::info\[Why Lightning]
Lightning has properties that make it a natural fit for session-based billing:

* **Open network**—Bitcoin is permissionless. A payment layer for the open internet should be just as open as the network it runs on.
* **Private by default**—Lightning payments are onion-routed. Only the payer and the payee know about a payment.
* **Micropayment-friendly**—Lightning can route sub-cent payments economically, making per-token and per-request billing practical at any price point.
* **Self-custodial**—Both client and server hold their own keys. Funds stay under each party's control throughout the entire flow.
  :::

## Integration

<Tabs stateKey="platform">
  <Tab title="Server">
    <div className="space-y-4">
      Use `spark.session` to accept prepaid Lightning sessions. The method handles deposit invoice generation, preimage verification, balance tracking, and refund on close.

      :::info
      Session support in `@buildonspark/lightning-mpp-sdk` is coming soon. The API below shows the anticipated interface based on the [specification](https://paymentauth.org/draft-lightning-session-00).
      :::

      ```ts
      import { Mppx, spark } from '@buildonspark/lightning-mpp-sdk/server'

      const mppx = Mppx.create({
        methods: [spark.session({ mnemonic: process.env.MNEMONIC! })],
        secretKey: process.env.MPP_SECRET_KEY!,
      })

      export async function handler(request: Request) {
        const result = await mppx.session({
          amount: '2',
          currency: 'BTC',
          unitType: 'token',
        })(request)

        if (result.status === 402) return result.challenge

        return result.withReceipt(Response.json({ data: '...' }))
      }
      ```
    </div>
  </Tab>

  <Tab title="Client">
    <div className="space-y-4">
      Use `spark.session` with `Mppx.create` to automatically handle deposits, bearer authentication, top-ups, and session close.

      ```ts
      import { Mppx, spark } from '@buildonspark/lightning-mpp-sdk/client'

      const method = spark.session({ mnemonic: process.env.MNEMONIC! })

      Mppx.create({
        methods: [method],
      })

      const response = await fetch('https://api.example.com/v1/chat/completions')
      // Automatically pays deposit, authenticates per request
      ```

      ### Without polyfill

      If you don't want to patch `globalThis.fetch`, use `mppx.fetch` directly:

      ```ts
      import { Mppx, spark } from '@buildonspark/lightning-mpp-sdk/client'

      const method = spark.session({ mnemonic: process.env.MNEMONIC! })

      const mppx = Mppx.create({
        methods: [method],
        polyfill: false,
      })

      try {
        const response = await mppx.fetch('https://api.example.com/v1/chat/completions')
        console.log(await response.json())
      } finally {
        await method.cleanup()
      }
      ```

      ### With multiple methods

      Register both charge and session so the client can handle either intent:

      ```ts
      import { Mppx, spark } from '@buildonspark/lightning-mpp-sdk/client'

      const charge = spark.charge({ mnemonic: process.env.MNEMONIC! })
      const session = spark.session({ mnemonic: process.env.MNEMONIC! })

      Mppx.create({
        methods: [charge, session],
      })
      ```

      :::info
      The Spark SDK maintains WebSocket connections for Lightning payments. Call `method.cleanup()` when done to close connections and allow the process to exit.
      :::
    </div>
  </Tab>
</Tabs>

## Specification

<Cards>
  <SpecCard to="https://paymentauth.org/draft-lightning-session-00" />
</Cards>

# Solana charge \[One-time payments on Solana]

The Solana implementation of the [charge](/intents/charge) intent.

The server issues a charge challenge describing the expected amount, currency, recipient, and Solana-specific `methodDetails`. The client either presents a signed transaction for server broadcast or presents a confirmed transaction signature. The server verifies the transfer on-chain and returns the resource with a receipt.

This method is best for fixed-price API calls, digital goods, and payments that should settle directly on Solana.

## Server

Use `solana.charge` to gate endpoints behind native SOL or SPL token payments.

```ts
import { Mppx } from 'mppx/server'
import { solana } from '@solana/mpp/server'

const mppx = Mppx.create({
  methods: [solana.charge({
    recipient: '9xAXssX9j7vuK99c7cFwqbixzL3bFrzPy9PUhCtDPAYJ',
    network: 'devnet',
  })],
  secretKey: process.env.MPP_SECRET_KEY!,
})
```

## Client

Use `solana.charge` with `Mppx.create` to automatically handle Solana charge challenges.

```ts
import { Mppx } from 'mppx/client'
import { solana } from '@solana/mpp/client'

const mppx = Mppx.create({
  methods: [solana.charge()],
})
```

## Solana-specific request fields

The Solana charge request extends the base charge schema with `methodDetails` fields such as:

* `network`
* `decimals`
* `tokenProgram`
* `feePayer`
* `feePayerKey`
* `splits`

These fields let the server describe whether payment is in SOL or an SPL asset, whether fee sponsorship is available, and whether the payment should be split across multiple recipients.

## Specification

<Cards>
  <SpecCard to="https://paymentauth.org/draft-solana-charge-00" />
</Cards>

# Stripe charge \[One-time payments using Shared Payment Tokens]

The Stripe implementation of the [charge](/intents/charge) intent.

The client creates a [Shared Payment Token (SPT)](https://docs.stripe.com/agentic-commerce/concepts/shared-payment-tokens) and sends it as a Credential. The server creates a Stripe `PaymentIntent` using the SPT, and settlement completes through Stripe's payment rails.

Use this method for single API calls, content access, or one-off purchases where you want to accept cards, wallets, or other Stripe-supported payment methods.

## Server

Use `stripe.charge` to require a one-time Stripe payment before returning a response. The method handles Challenge generation, Credential verification, PaymentIntent creation, and Receipt generation.

You can provide either a `client` (a pre-configured Stripe SDK instance) or a raw `secretKey`. Using `client` is recommended — it lets you configure retries, API version, and other options on the Stripe instance you control.

### With Stripe SDK client (recommended)

```ts twoslash

import Stripe from 'stripe'
import { Mppx, stripe } from 'mppx/server'

const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY!)

const mppx = Mppx.create({
  methods: [
    stripe.charge({
      client: stripeClient, // [!code hl]
      networkId: 'internal',
      paymentMethodTypes: ['card'],
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

### With secret key

If you don't need to customize the Stripe SDK instance, pass a `secretKey` directly and mppx will make raw API calls to Stripe.

```ts twoslash
import { Mppx, stripe } from 'mppx/server'

const mppx = Mppx.create({
  methods: [
    stripe.charge({
      secretKey: process.env.STRIPE_SECRET_KEY!, // [!code hl]
      networkId: 'internal',
      paymentMethodTypes: ['card'],
    }),
  ],
})
```

### With metadata

Include `metadata` in the `stripe.charge` configuration to forward key-value pairs to Stripe. The metadata appears in the Challenge and attaches to the Stripe `PaymentIntent`.

```ts twoslash

import Stripe from 'stripe'
import { Mppx, stripe } from 'mppx/server'

const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY!)

const mppx = Mppx.create({
  methods: [
    stripe.charge({
      client: stripeClient,
      metadata: { plan: 'pro' }, // [!code hl]
      networkId: 'internal',
      paymentMethodTypes: ['card'],
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

import Stripe from 'stripe'
import { Mppx, stripe } from 'mppx/server'

const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY!)

const mppx = Mppx.create({
  methods: [
    stripe.charge({
      client: stripeClient,
      networkId: 'internal',
      paymentMethodTypes: ['card', 'link'], // [!code hl]
    }),
  ],
})
```

### Server parameters

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `client` | `StripeClient` | One of `client` or `secretKey` | Pre-configured Stripe SDK instance (`new Stripe(...)`) |
| `secretKey` | `string` | One of `client` or `secretKey` | Stripe secret API key (mppx makes raw API calls) |
| `metadata` | `Record<string, string>` | Optional | Key-value pairs forwarded to Stripe |
| `networkId` | `string` | Required | Stripe [Business Network](https://docs.stripe.com/get-started/account/profile) profile ID |
| `paymentMethodTypes` | `string[]` | Required | Allowed Stripe payment method types |

## Client

Use `stripe` with `Mppx.create` to automatically handle `402` responses. The client parses the Challenge, creates an SPT through the `createToken` callback, and retries with the Credential.

SPT creation requires a Stripe secret key, so the client accepts a `createToken` callback that proxies through a server endpoint. You can optionally pass a `client` (a Stripe.js instance from `@stripe/stripe-js`) which is forwarded to the `createToken` callback for use with Elements.

### Simple (known payment method)

If you already have a payment method ID (e.g. a test card or a stored method), pass it as `paymentMethod` and mppx handles the full 402 → SPT → retry flow automatically.

```ts twoslash

import { loadStripe } from '@stripe/stripe-js'
import { Mppx, stripe } from 'mppx/client'

const stripeJs = (await loadStripe('pk_test_...'))!

Mppx.create({
  methods: [
    stripe({
      client: stripeJs,
      createToken: async (params) => {
        const res = await fetch('/api/create-spt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(params),
        })
        if (!res.ok) throw new Error('Failed to create SPT')
        return (await res.json()).spt
      },
      paymentMethod: 'pm_card_visa', // [!code hl]
    }),
  ],
})

// fetch() now handles 402 → credential → retry automatically
const response = await fetch('https://api.example.com/resource')
// @log: Response { status: 200, ... }
```

### With Stripe Elements

For interactive payment collection, use `onChallenge` to render Stripe Elements when a 402 is received. The user enters card details, you create a payment method, then pass it to `createCredential`.

```ts twoslash

import { loadStripe } from '@stripe/stripe-js'
import { Receipt } from 'mppx'
import { Mppx, stripe } from 'mppx/client'

const stripeJs = (await loadStripe('pk_test_...'))!

const mppx = Mppx.create({
  methods: [
    stripe.charge({
      client: stripeJs,
      createToken: async ({ amount, currency, expiresAt, metadata, networkId, paymentMethod }) => {
        const response = await fetch('/api/create-spt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paymentMethod, amount, currency, networkId, expiresAt, metadata }),
        })
        if (!response.ok) throw new Error('Failed to create SPT')
        return (await response.json()).spt
      },
    }),
  ],
  onChallenge: async (challenge, { createCredential }) => {
    // Extract payment method types from the challenge
    const methodDetails = challenge.request.methodDetails as
      | { paymentMethodTypes?: string[] }
      | undefined
    const paymentMethodTypes = methodDetails?.paymentMethodTypes ?? ['card']

    // Create Stripe Elements for payment collection
    const elements = stripeJs.elements({
      mode: 'payment',
      amount: Number(challenge.request.amount),
      currency: challenge.request.currency as string,
      paymentMethodTypes,
      paymentMethodCreation: 'manual',
    })

    // Mount the payment element (you'd mount this to a DOM container)
    const paymentElement = elements.create('payment')
    paymentElement.mount('#payment-element')

    // After user submits the form:
    await elements.submit()
    const { paymentMethod } = await stripeJs.createPaymentMethod({ elements })

    // Create credential with the collected payment method
    return createCredential({ paymentMethod: paymentMethod!.id })
  },
  polyfill: false,
})

const response = await mppx.fetch('/api/resource')
const receipt = Receipt.fromResponse(response)
```

### Manual flow (without Mppx.create)

For full control over each step, use `stripe.charge()` directly with `Challenge.fromResponse`:

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

import { loadStripe } from '@stripe/stripe-js'
import { Mppx, stripe } from 'mppx/client'

const stripeJs = (await loadStripe('pk_test_...'))!

const mppx = Mppx.create({
  methods: [
    stripe({
      client: stripeJs,
      createToken: async (params) => {
        const res = await fetch('/api/create-spt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(params),
        })
        return (await res.json()).spt
      },
    }),
  ],
  polyfill: false,
})

const response = await mppx.fetch('https://api.example.com/resource')
```

## SPT creation proxy endpoint

The `createToken` callback proxies through your own server because SPT creation requires a Stripe secret key. Here's a minimal implementation:

```ts
export async function POST(request: Request) {
  const { paymentMethod, amount, currency, expiresAt, networkId, metadata } =
    await request.json()

  const body = new URLSearchParams({
    payment_method: paymentMethod,
    'usage_limits[currency]': currency,
    'usage_limits[max_amount]': amount,
    'usage_limits[expires_at]': expiresAt.toString(),
  })
  if (metadata) {
    for (const [key, value] of Object.entries(metadata)) {
      body.set(`metadata[${key}]`, value)
    }
  }

  const response = await fetch(
    'https://api.stripe.com/v1/test_helpers/shared_payment/granted_tokens',
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${btoa(`${process.env.STRIPE_SECRET_KEY}:`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    },
  )

  if (!response.ok) {
    const error = await response.json()
    return Response.json({ error: error.error.message }, { status: 400 })
  }

  const { id: spt } = await response.json()
  return Response.json({ spt })
}
```

:::info
The `test_helpers/shared_payment/granted_tokens` endpoint is for testing. In production, SPTs are created through the agent-side `issued_tokens` API.
:::

### Client parameters

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `client` | `StripeJs` | Optional | Stripe.js instance from `@stripe/stripe-js` — forwarded to `createToken` for use with Elements |
| `createToken` | `(params) => Promise<string>` | Required | Callback to create an SPT (proxied through a server endpoint) |
| `externalId` | `string` | Optional | Client reference ID included in the Credential payload |
| `paymentMethod` | `string` | Optional | Default Stripe payment method ID (overridden by `context.paymentMethod`) |

### `createToken` callback parameters

The `createToken` callback receives a single object with the following fields:

| Field | Type | Description |
| --- | --- | --- |
| `amount` | `string` | Payment amount in smallest currency unit |
| `challenge` | `Challenge` | The parsed Challenge from the server |
| `client` | `StripeJs \| undefined` | Stripe.js instance, if provided to `stripe.charge()` |
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
| `spt` | `string` | Required | Shared Payment Token ID (starts with `spt_`) |

## Specification

<Cards>
  <SpecCard to="https://paymentauth.org/draft-stripe-charge-00" />
</Cards>

# Tempo charge \[One-time TIP-20 token transfers]

The Tempo implementation of the [charge](/intents/charge) intent.

The client signs a TIP-20 `transfer` transaction, the server broadcasts it to Tempo, and settlement completes in ~500ms with deterministic finality.

This method is best for single API calls, content access, or one-off purchases.

## Server

Use [`mppx.charge`](/sdk/typescript/server/Method.tempo.charge) to gate any endpoint behind a one-time payment. The method handles Challenge generation, Credential verification, transaction broadcast, and Receipt creation.

```ts twoslash
import { Mppx, tempo } from "mppx/server";

const mppx = Mppx.create({
  methods: [tempo()],
});

export async function handler(request: Request) {
  const result = await mppx.charge({
    amount: "0.1",
    currency: "0x20c0000000000000000000000000000000000000",
    recipient: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  })(request);

  if (result.status === 402) return result.challenge;

  return result.withReceipt(Response.json({ data: "..." }));
}
```

### With expiry

```ts twoslash
import { Mppx, tempo } from "mppx/server";

const mppx = Mppx.create({ methods: [tempo()] });
// ---cut---
import { Expires } from "mppx";

export async function handler(request: Request) {
  const result = await mppx.charge({
    amount: "0.1",
    currency: "0x20c0000000000000000000000000000000000000",
    expires: Expires.minutes(10), // [!code hl]
    recipient: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  })(request);

  if (result.status === 402) return result.challenge;
  return result.withReceipt(Response.json({ data: "..." }));
}
```

### With fee sponsorship

```ts twoslash
import { Mppx, tempo } from "mppx/server";

const mppx = Mppx.create({ methods: [tempo()] });

declare const request: Request;
// ---cut---
const result = await mppx.charge({
  amount: "0.1",
  currency: "0x20c0000000000000000000000000000000000000",
  feePayer: true, // [!code hl]
  recipient: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
})(request);
```

When `feePayer` is `true`, the server adds a fee payer signature (domain `0x78`) before broadcasting. The client doesn't need gas tokens. See [fee sponsorship](/payment-methods/tempo#fee-sponsorship) for details.

### With Stripe

```ts twoslash
// @noErrors
import { Mppx, tempo } from "mppx/server";

function async createPayToAddress(request: Request) {
   // Create Stripe PaymentIntent
}

export async function handler(request: Request) {
  const recipientAddress = await createPayToAddress(request)
  const mppx = Mppx.create({
    methods: [
      tempo.charge({
        currency: "0x20c0000000000000000000000000000000000000",
        recipient: recipientAddress,
      }),
    ],
  });

  const result = await mppx.charge({ amount: "0.01" })(request);
 
  if (result.status === 402) return result.challenge;
 
  return result.withReceipt(Response.json({ data: "..." }));
}
```

Use Stripe to create a dynamic recipient address per payment, each backed by a PaymentIntent. To learn more, read the [Stripe documentation](https://docs.stripe.com/payments/machine/mpp) on accepting MPP.

:::info
See [`tempo.charge` server reference](/sdk/typescript/server/Method.tempo.charge) for the full parameter list.
:::

## Client

Use [`tempo.charge`](/sdk/typescript/client/Method.tempo.charge) with `Mppx.create` to automatically handle `402` responses. The client parses the Challenge, signs a TIP-20 transfer, and retries with the Credential.

```ts twoslash
import { Mppx, tempo } from "mppx/client";
import { privateKeyToAccount } from "viem/accounts";

const account = privateKeyToAccount("0xabc…123");

Mppx.create({
  methods: [tempo.charge({ account })],
});

const response = await fetch("https://api.example.com/resource");
```

### Without polyfill

If you don't want to patch `globalThis.fetch`, use `mppx.fetch` directly:

```ts twoslash
import { Mppx, tempo } from "mppx/client";
import { privateKeyToAccount } from "viem/accounts";

const account = privateKeyToAccount("0xabc…123");

const mppx = Mppx.create({
  methods: [tempo.charge({ account })],
  polyfill: false,
});

const response = await mppx.fetch("https://api.example.com/resource");
```

:::info
See [`tempo.charge` client reference](/sdk/typescript/client/Method.tempo.charge) for the full parameter list.
:::

### Auto-swap

When the client doesn't hold the requested currency, `autoSwap` automatically swaps from a fallback stablecoin (pathUSD, USDC.e) via the Tempo DEX before transferring.

```ts twoslash
import { Mppx, tempo } from "mppx/client";
import { privateKeyToAccount } from "viem/accounts";

const account = privateKeyToAccount("0xabc…123");

Mppx.create({
  methods: [
    tempo.charge({
      account,
      autoSwap: true, // [!code hl]
    }),
  ],
});
```

Pass an object for custom fallback tokens or slippage:

```ts twoslash
import { Mppx, tempo } from "mppx/client";
import { privateKeyToAccount } from "viem/accounts";

const account = privateKeyToAccount("0xabc…123");

Mppx.create({
  methods: [
    tempo.charge({
      account,
      autoSwap: {
        // [!code hl]
        slippage: 2, // max slippage % (default: 1) // [!code hl]
        tokenIn: ["0x0000000000000000000000000000000000000001"], // [!code hl]
      }, // [!code hl]
    }),
  ],
});
```

See [auto-swap](/payment-methods/tempo#auto-swap) for more details.

## Specification

<Cards>
  <SpecCard to="https://paymentauth.org/draft-tempo-charge-00" />
</Cards>

# Session \[Low-cost high-throughput payments]

The `session` intent enables high-frequency, pay-as-you-go payments over unidirectional payment channels. Clients deposit funds into an on-chain escrow and sign off-chain vouchers as they consume resources. The server verifies vouchers with fast signature checks—no RPC or blockchain calls—and settles periodically in batches.

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

Voucher verification is CPU-bound: a single `ecrecover` call against the EIP-712 typed data. No RPC calls. No database lookups in the critical path. This is what enables per-token LLM billing without adding latency.

### Top up

If the channel runs low on funds, the client deposits additional tokens without closing the channel. The session continues uninterrupted.

### Close

Either party can close the channel. The server calls `close()` on the escrow contract with the highest voucher, settling the final balance on-chain and refunding any unused deposit to the client.

::::

## Session receipts

Session Receipts differ from charge Receipts. The `reference` field contains the payment channel ID (a `bytes32` hash), not a transaction hash. The on-chain settlement transaction hash is only available after closing the channel.

| Field | Charge receipt | Session receipt |
|-------|---------------|-----------------|
| `reference` | Transaction hash | Channel ID |
| `status` | `"success"` | `"success"` |
| `method` | `"tempo"` | `"tempo"` |

To get the settlement transaction hash, close the channel via `session.close()` and read the `txHash` field from the returned receipt.

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
            recipient: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
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
            recipient: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
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
        methods: [tempo.session({ account })],
        polyfill: false,
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

      ### Closing the channel

      Channels remain open for reuse across requests. Call `session.close()` to settle on-chain and reclaim unspent deposit.

      :::warning
      Channels do not close automatically. If you don't call `close()`, the deposit stays locked in the escrow contract until the channel expires or is manually closed.
      :::

      See [`tempo.session` manager](/sdk/typescript/client/Method.tempo.session-manager) for the full session lifecycle API.
    </div>
  </Tab>
</Tabs>

## Escrow contract

Sessions use the `TempoStreamChannel` escrow contract for on-chain deposits, settlement, and channel close. The [reference implementation](https://github.com/tempoxyz/tempo/blob/main/tips/ref-impls/src/TempoStreamChannel.sol) lives in the `tempoxyz/tempo` repository.

| Network | Chain ID | Contract Address |
|---|---|---|
| [Mainnet](https://explore.mainnet.tempo.xyz/address/0x33b901018174DDabE4841042ab76ba85D4e24f25?tab=contract) | 4217 | `0x33b901018174DDabE4841042ab76ba85D4e24f25` |
| [Testnet (Moderato)](https://explore.testnet.tempo.xyz/address/0xe1c4d3dce17bc111181ddf716f75bae49e61a336?tab=contract) | 42431 | `0xe1c4d3dce17bc111181ddf716f75bae49e61a336` |

## Specification

<Cards>
  <SpecCard to="https://paymentauth.org/draft-tempo-session-00" />
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
  <SpecCard to="https://paymentauth.org" />
</Cards>

# MCP and JSON-RPC transport \[Payment flows for AI tool calls]

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
  <SpecCard to="https://paymentauth.org" />
</Cards>

# Client \[Handle 402 responses automatically]

The `Client` class wraps `httpx` and intercepts `402` responses—it parses the Challenge, signs a stablecoin transfer, and retries with the Credential.

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
        recipient="0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
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
        recipient="0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
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
    recipient="0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
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
        recipient="0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
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
        recipient="0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
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

The `Fetch` extension trait adds `.send_with_payment()` to any `reqwest::RequestBuilder`—when a server returns `402`, it parses the Challenge, signs a stablecoin transfer, and retries with the Credential.

## Quick start

```rust
use mpp::client::{Fetch, TempoProvider};
use mpp::PrivateKeySigner;

let signer = PrivateKeySigner::random();
let provider = TempoProvider::new(signer, "https://rpc.tempo.xyz")?;

let response = reqwest::Client::new()
    .get("https://api.example.com/paid")
    .send_with_payment(&provider)
    .await?;

println!("Status: {}", response.status());
```

When the server returns `402`, `send_with_payment`:

1. Parses the Challenge from the `WWW-Authenticate` header
2. Calls `provider.pay()` to sign a stablecoin transfer
3. Retries the request with the Credential in the `Authorization` header

## `TempoProvider`

`TempoProvider` signs TIP-20 stablecoin transfers on the Tempo blockchain.

```rust
use mpp::client::TempoProvider;
use mpp::PrivateKeySigner;

let signer: PrivateKeySigner = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
    .parse()?;

let provider = TempoProvider::new(signer, "https://rpc.tempo.xyz")?;
```

### With client ID

Attach an identifier to transactions for attribution:

```rust
let provider = TempoProvider::new(signer, "https://rpc.tempo.xyz")?
    .with_client_id("my-app");
```

## Middleware

For automatic `402` handling on all requests, use `PaymentMiddleware` with `reqwest-middleware`. Requires the `middleware` feature.

```toml
mpp = { version = "0.1", features = ["tempo", "client", "middleware"] }
```

```rust
use mpp::client::{PaymentMiddleware, TempoProvider};
use reqwest_middleware::ClientBuilder;

let provider = TempoProvider::new(signer, "https://rpc.tempo.xyz")?;

let client = ClientBuilder::new(reqwest::Client::new())
    .with(PaymentMiddleware::new(provider))
    .build();

// All requests through this client handle 402 automatically
let response = client.get("https://api.example.com/paid").send().await?;
```

## Multiple providers

`MultiProvider` wraps multiple payment providers and picks the right one based on the challenge's `method` and `intent`:

```rust
use mpp::client::{MultiProvider, TempoProvider};

let provider = MultiProvider::new()
    .with(TempoProvider::new(signer, "https://rpc.tempo.xyz")?);

let response = reqwest::Client::new()
    .get("https://api.example.com/paid")
    .send_with_payment(&provider)
    .await?;
```

## Custom provider

Implement the `PaymentProvider` trait to add support for custom payment methods:

```rust
use mpp::client::PaymentProvider;
use mpp::{PaymentChallenge, PaymentCredential, PaymentPayload, MppError};

#[derive(Clone)]
struct MyProvider;

impl PaymentProvider for MyProvider {
    fn supports(&self, method: &str, intent: &str) -> bool {
        method == "my_network" && intent == "charge"
    }

    async fn pay(
        &self,
        challenge: &PaymentChallenge,
    ) -> Result<PaymentCredential, MppError> {
        let echo = challenge.to_echo();
        Ok(PaymentCredential::new(echo, PaymentPayload::hash("0x...")))
    }
}
```

## Key types

| Type | Description |
|------|-------------|
| `Fetch` (`PaymentExt`) | Extension trait that adds `send_with_payment` to `reqwest::RequestBuilder` |
| `MultiProvider` | Wraps multiple providers, routes by method and intent |
| `PaymentMiddleware` | reqwest-middleware for automatic `402` handling |
| `PaymentProvider` | Trait for custom payment method implementations |
| `TempoProvider` | Signs Tempo stablecoin transfers |

# Core types \[Challenge, Credential, and Receipt primitives]

These types map directly to HTTP headers—`WWW-Authenticate`, `Authorization`, and `Payment-Receipt`—and can be used independently of the higher-level client and server APIs.

```rust
use mpp::{PaymentChallenge, PaymentCredential, Receipt};
```

## Parse a Challenge

Parse a `WWW-Authenticate` header into a typed `PaymentChallenge`:

```rust
use mpp::parse_www_authenticate;

let header = r#"Payment id="abc", realm="api.example.com", method="tempo", intent="charge", request="eyJhbW91bnQiOiIxMDAwIn0""#;
let challenge = parse_www_authenticate(header)?;

println!("Method: {}", challenge.method);
println!("Intent: {}", challenge.intent);
```

Decode the base64url-encoded request to a typed struct:

```rust
use mpp::ChargeRequest;

let request: ChargeRequest = challenge.request.decode()?;
println!("Amount: {}", request.amount);
```

## Create a Credential

Build a `PaymentCredential` from a challenge echo and payment proof:

```rust
use mpp::{PaymentCredential, PaymentPayload, format_authorization};

let credential = PaymentCredential::with_source(
    challenge.to_echo(),
    "did:pkh:eip155:42431:0xa726a1...",
    PaymentPayload::transaction("0xf86c..."),
);

let header = format_authorization(&credential)?;
// header = "Payment eyJ..."
```

## Parse a Receipt

Parse the `Payment-Receipt` response header:

```rust
use mpp::parse_receipt;

let receipt = parse_receipt(receipt_header)?;
println!("Status: {:?}", receipt.status);
println!("Reference: {}", receipt.reference);
```

Serialize a Receipt back to a header value:

```rust
use mpp::format_receipt;

let header = format_receipt(&receipt)?;
```

## Type reference

| Type | Description |
|------|-------------|
| `PaymentChallenge` | Server challenge parsed from `WWW-Authenticate` |
| `PaymentCredential` | Client credential for the `Authorization` header |
| `PaymentPayload` | Payment proof—either `transaction` (signed tx) or `hash` (tx hash) |
| `ChallengeEcho` | Echoed challenge fields in a Credential |
| `Receipt` | Server receipt parsed from `Payment-Receipt` |
| `ChargeRequest` | Decoded charge intent request data |
| `SessionRequest` | Decoded session intent request data |
| `Base64UrlJson` | JSON value encoded as base64url |

## Header functions

| Function | Description |
|----------|-------------|
| `format_authorization` | Serialize a Credential to an `Authorization` header value |
| `format_receipt` | Serialize a Receipt to a `Payment-Receipt` header value |
| `format_www_authenticate` | Serialize a Challenge to a `WWW-Authenticate` header value |
| `parse_authorization` | Parse an `Authorization` header into a Credential |
| `parse_receipt` | Parse a `Payment-Receipt` header into a Receipt |
| `parse_www_authenticate` | Parse a `WWW-Authenticate` header into a Challenge |

# Server \[Protect endpoints with payment requirements]

Create an `Mpp` instance with `Mpp::create()` and call `charge()` with a human-readable dollar amount. The `tempo()` factory configures `recipient` once, then every `charge()` call uses those defaults.

## Quick start

```rust
use mpp::server::{Mpp, tempo, TempoConfig};

let mpp = Mpp::create(tempo(TempoConfig {
    recipient: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
}))?;

let challenge = mpp.charge("0.10")?;
let receipt = mpp.verify_credential(&credential).await?;
```

`Mpp::create()` auto-detects `realm` from environment variables (`VERCEL_URL`, `FLY_APP_NAME`, `HOSTNAME`, and others) and reads `MPP_SECRET_KEY` for stateless HMAC verification. Pass explicit values with the builder to override:

```rust
let mpp = Mpp::create(
    tempo(TempoConfig {
        recipient: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    })
    .realm("api.example.com")
    .secret_key("my-server-secret")
)?;
```

## Axum handler example

Use `charge()` to generate a Challenge and `verify_credential()` to verify the retry:

```rust
use mpp::server::{Mpp, tempo, TempoConfig};
use mpp::{parse_authorization, format_www_authenticate};

let mpp = Mpp::create(tempo(TempoConfig {
    recipient: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
}))?;

// In your handler, check for an Authorization header:
let auth = headers.get("authorization").and_then(|v| v.to_str().ok());

match auth {
    Some(auth_header) => {
        // Parse and verify the Credential
        let credential = parse_authorization(auth_header)?;
        let receipt = mpp.verify_credential(&credential).await?;
        // → return 200 with paid content + Payment-Receipt header
    }
    None => {
        // No Credential — issue a Challenge
        let challenge = mpp.charge("0.50")?;
        let header = format_www_authenticate(&challenge)?;
        // → return 402 with WWW-Authenticate header
    }
}
```

For a declarative approach with less boilerplate, use the [Axum extractor](#axum-extractor) instead.

## `tempo()` builder

`tempo()` creates a `TempoBuilder` with smart defaults. Only `recipient` is required.

```rust
use mpp::server::{tempo, TempoConfig};

let builder = tempo(TempoConfig {
    recipient: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
})
.currency("0x20c0000000000000000000000000000000000000")
.decimals(6)
.fee_payer(true)
.realm("api.example.com")
.rpc_url("https://rpc.moderato.tempo.xyz")
.secret_key("my-secret");
```

### `tempo()` parameters

### chain\_id (optional)

* **Type:** `u64`

Explicitly set the chain ID. Auto-detected from the RPC URL if omitted (moderato → `42431`, otherwise → `4217`).

### currency (optional)

* **Type:** `&str`
* **Default:** USDC on mainnet, pathUSD on testnet

TIP-20 token address for charges.

### decimals (optional)

* **Type:** `u32`
* **Default:** `6`

Token decimal places for dollar-to-base-unit conversion.

### fee\_payer (optional)

* **Type:** `bool`
* **Default:** `false`

Enable fee sponsorship for all Challenges. When enabled, the server co-signs and sponsors transaction gas fees.

### realm (optional)

* **Type:** `&str`

Server realm for `WWW-Authenticate` headers. Auto-detected from `MPP_REALM`, `VERCEL_URL`, `FLY_APP_NAME`, `HOSTNAME`, and others.

### rpc\_url (optional)

* **Type:** `&str`
* **Default:** `"https://rpc.tempo.xyz"`

Tempo RPC endpoint URL. Also auto-detects chain ID from the URL.

### secret\_key (optional)

* **Type:** `&str`

HMAC secret for stateless Challenge ID verification. Reads `MPP_SECRET_KEY` environment variable if omitted.

## `charge()` parameters

### amount

* **Type:** `&str`

Payment amount in dollars (for example, `"0.50"` for $0.50). Automatically converted to base units using the configured decimals.

## `charge_with_options()`

Pass `ChargeOptions` for additional control:

```rust
use mpp::server::ChargeOptions;

let challenge = mpp.charge_with_options("1.00", ChargeOptions {
    description: Some("Premium content"),
    external_id: Some("order-123"),
    fee_payer: true,
    ..Default::default()
})?;
```

### description (optional)

* **Type:** `Option<&str>`

Human-readable description attached to the Challenge.

### expires (optional)

* **Type:** `Option<&str>`

Challenge expiration as ISO 8601 timestamp. Defaults to 5 minutes from now.

### external\_id (optional)

* **Type:** `Option<&str>`

Merchant reference ID for reconciliation.

### fee\_payer (optional)

* **Type:** `bool`

Override the server-level fee sponsorship setting for this Challenge.

## Verify a Credential

`verify_credential` decodes the charge request from the echoed challenge automatically—no need to reconstruct the request:

```rust
let receipt = mpp.verify_credential(&credential).await?;
println!("Reference: {}", receipt.reference);
```

To prevent cross-route replay attacks, verify against expected values:

```rust
use mpp::ChargeRequest;

let expected = ChargeRequest {
    amount: "100000".into(),
    currency: "0x20c0000000000000000000000000000000000000".into(),
    recipient: Some("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266".into()),
    ..Default::default()
};

let receipt = mpp
    .verify_credential_with_expected_request(&credential, &expected)
    .await?;
```

## Axum extractor

The `MppCharge<C>` extractor handles the full `402` challenge/verify flow automatically. Requires the `axum` feature.

Define a `ChargeConfig` type for each price point:

```rust
use mpp::server::axum::{ChargeConfig, MppCharge, ChargeChallenger};
use mpp::server::{Mpp, tempo, TempoConfig};
use axum::{routing::get, Router, Json};
use std::sync::Arc;

struct OneCent;
impl ChargeConfig for OneCent {
    fn amount() -> &'static str { "0.01" }
}

struct OneDollar;
impl ChargeConfig for OneDollar {
    fn amount() -> &'static str { "1.00" }
    fn description() -> Option<&'static str> { Some("Premium content") }
}

async fn cheap(charge: MppCharge<OneCent>) -> Json<serde_json::Value> {
    Json(serde_json::json!({ "paid": true, "ref": charge.receipt.reference }))
}

async fn expensive(charge: MppCharge<OneDollar>) -> &'static str {
    "premium content"
}

let mpp = Mpp::create(tempo(TempoConfig {
    recipient: "0xabc...",
})).unwrap();

let app = Router::new()
    .route("/basic", get(cheap))
    .route("/premium", get(expensive))
    .with_state(Arc::new(mpp) as Arc<dyn ChargeChallenger>);
```

The extractor returns `402` with a `WWW-Authenticate` Challenge when no `Authorization` header is present, and extracts a verified `Receipt` when a valid Credential is provided.

## Session support

For payment session channels, add a `SessionMethod` and generate session Challenges:

```rust
use mpp::server::SessionChallengeOptions;

let challenge = mpp.session_challenge_with_details(
    "1000",                                             // amount per unit (base units)
    "0x20c0000000000000000000000000000000000000",        // currency
    "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",        // recipient
    SessionChallengeOptions {
        unit_type: Some("token"),
        suggested_deposit: Some("60000"),
        fee_payer: true,
        ..Default::default()
    },
)?;
```

Verify session credentials (vouchers):

```rust
let result = mpp.verify_session(&credential).await?;
println!("Receipt: {:?}", result.receipt);

// Management responses (channel open/close) return a body to forward
if let Some(body) = result.management_response {
    return Ok(Json(body));
}
```

### `SessionChallengeOptions` parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `description` | `Option<&str>` | Human-readable description |
| `expires` | `Option<&str>` | Challenge expiration (ISO 8601) |
| `fee_payer` | `bool` | Enable fee sponsorship |
| `suggested_deposit` | `Option<&str>` | Suggested deposit in base units |
| `unit_type` | `Option<&str>` | Unit label (for example, `"token"`, `"byte"`) |

## Advanced API

For full control, use `Mpp::new()` with a manual `TempoChargeMethod`:

```rust
use mpp::server::{Mpp, tempo_provider, TempoChargeMethod};

let provider = tempo_provider("https://rpc.tempo.xyz")?;
let method = TempoChargeMethod::new(provider);
let payment = Mpp::new(method, "api.example.com", "my-server-secret");

// Generate challenges with explicit base units
let challenge = payment.charge_challenge(
    "1000000",
    "0x20c0000000000000000000000000000000000000",
    "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
)?;

// Verify with an explicit request
let receipt = payment.verify(&credential, &charge_request).await?;
```

## Key types

| Type | Description |
|------|-------------|
| `ChargeMethod` | Trait for custom charge verification |
| `ChargeOptions` | Options for `charge_with_options()` |
| `Mpp` | Server handler binding method, realm, and secret |
| `SessionChallengeOptions` | Options for `session_challenge_with_details()` |
| `SessionMethod` | Trait for session/channel verification |
| `SessionVerifyResult` | Result of session verification with optional management response |
| `TempoChargeMethod` | Built-in Tempo charge verification |
| `TempoConfig` | Configuration struct for the `tempo()` factory |

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
$ bunx mppx example
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

## Init command

Create an `mppx.config.ts` file in the current directory:

```bash [terminal]
$ mppx init
```

Use `--force` to overwrite an existing config file:

```bash [terminal]
$ mppx init --force
```

## Sign command

Sign a payment Challenge and output the `Authorization` header value without making a request. Accepts a challenge via `--challenge` or stdin.

```bash [terminal]
$ mppx sign --challenge 'Payment method="tempo-session";chain-id=4217;...'
```

```bash [terminal]
$ echo 'Payment method="tempo-session";chain-id=4217;...' | mppx sign
```

Use `--dry-run` to validate and parse a Challenge without signing:

```bash [terminal]
$ mppx sign --challenge 'Payment method="tempo-session";...' --dry-run
```

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

## Agent integration

Register `mppx` as an MCP server for use with coding agents:

```bash [terminal]
$ mppx mcp add
```

Sync skill files to your agent's skill directory:

```bash [terminal]
$ mppx skills add
```

Generate shell completions:

```bash [terminal]
$ mppx completions
```

# `Method.from` \[Create a payment method from a definition]

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

# Proxy \[Paid API proxy]

Gates upstream API services behind MPP `402` payments. The proxy handles routing, credential injection, and payment verification—you configure which endpoints require payment and which are free passthrough.

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

Import `Proxy` and a service preset from `mppx/proxy`, then create an `Mppx` server instance from `mppx/server` to define payment intents.

```ts twoslash [server.ts]
import { Proxy, openai } from 'mppx/proxy'
import { Mppx, tempo } from 'mppx/server'

const mppx = Mppx.create({ methods: [tempo()] })

const proxy = Proxy.create({
  services: [
    openai({
      apiKey: process.env.OPENAI_API_KEY!,
      routes: {
        'POST /v1/chat/completions': mppx.charge({ amount: '0.05' }),
        'GET /v1/models': true,
      },
    }),
  ],
})

// Bun / Deno
export default { fetch: proxy.fetch }

// Node.js
import { createServer } from 'node:http'
createServer(proxy.listener).listen(3000)
```

The proxy returns two handlers:

* **`fetch`** — Fetch API handler. Works with Bun, Deno, Next.js, Hono, Elysia, and SvelteKit.
* **`listener`** — Node.js request listener. Works with Express, Fastify, and `http.createServer`.

### Multiple services

Pass multiple services to gate several upstream APIs behind a single proxy.

```ts twoslash [server.ts]
import { Proxy, anthropic, openai, stripe } from 'mppx/proxy'
import { Mppx, tempo } from 'mppx/server'

const mppx = Mppx.create({ methods: [tempo()] })

const proxy = Proxy.create({
  description: 'Multi-service paid API proxy',
  title: 'My Proxy',
  services: [
    openai({
      apiKey: process.env.OPENAI_API_KEY!,
      routes: {
        'POST /v1/chat/completions': mppx.charge({ amount: '0.05' }),
      },
    }),
    anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY!,
      routes: {
        'POST /v1/messages': mppx.charge({ amount: '0.03' }),
      },
    }),
    stripe({
      apiKey: process.env.STRIPE_API_KEY!,
      routes: {
        'POST /v1/charges': mppx.charge({ amount: '1' }),
        'GET /v1/customers/:id': true,
      },
    }),
  ],
})
```

Each service is mounted at `/{serviceId}/`—for example, requests to `/openai/v1/chat/completions` route to `https://api.openai.com/v1/chat/completions`.

## Built-in services

### `openai`

Creates an OpenAI service definition. Injects `Authorization: Bearer` header for upstream authentication.

```ts [server.ts]
import { openai } from 'mppx/proxy'

openai({
  apiKey: 'sk-...',
  routes: {
    'POST /v1/chat/completions': mppx.charge({ amount: '0.05' }),
    'POST /v1/embeddings': mppx.charge({ amount: '0.01' }),
    'POST /v1/images/generations': mppx.charge({ amount: '0.10' }),
    'GET /v1/models': true,
  },
})
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `apiKey` | `string` | OpenAI API key. Used as `Authorization: Bearer` header. |
| `baseUrl` (optional) | `string` | Base URL override. Defaults to `'https://api.openai.com'`. |
| `routes` | `EndpointMap` | Route definitions for OpenAI endpoints. |

**Typed routes:** `POST /v1/chat/completions`, `POST /v1/completions`, `POST /v1/embeddings`, `POST /v1/images/generations`, `POST /v1/images/edits`, `POST /v1/images/variations`, `POST /v1/audio/transcriptions`, `POST /v1/audio/translations`

### `anthropic`

Creates an Anthropic service definition. Injects `x-api-key` header for upstream authentication.

```ts [server.ts]
import { anthropic } from 'mppx/proxy'

anthropic({
  apiKey: 'sk-ant-...',
  routes: {
    'POST /v1/messages': mppx.charge({ amount: '0.03' }),
    'POST /v1/complete': mppx.charge({ amount: '0.02' }),
  },
})
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `apiKey` | `string` | Anthropic API key. Used as `x-api-key` header. |
| `baseUrl` (optional) | `string` | Base URL override. Defaults to `'https://api.anthropic.com'`. |
| `routes` | `EndpointMap` | Route definitions for Anthropic endpoints. |

**Typed routes:** `POST /v1/messages`, `POST /v1/messages/batches`, `GET /v1/messages/batches`, `GET /v1/messages/batches/:batchId`, `POST /v1/complete`

### `stripe`

Creates a Stripe service definition. Injects `Authorization: Basic` header (API key as username) for upstream authentication. This is a proxy service for the Stripe API—not a payment method.

```ts [server.ts]
import { stripe } from 'mppx/proxy'

stripe({
  apiKey: 'sk-...',
  routes: {
    'POST /v1/charges': mppx.charge({ amount: '1' }),
    'GET /v1/customers/:id': true,
  },
})
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `apiKey` | `string` | Stripe API key. Used as Basic auth username. |
| `baseUrl` (optional) | `string` | Base URL override. Defaults to `'https://api.stripe.com'`. |
| `routes` | `EndpointMap` | Route definitions for Stripe endpoints. |

**Typed routes:** `POST /v1/charges`, `POST /v1/customers`, `GET /v1/customers/:id`, `POST /v1/payment_intents`, `GET /v1/payment_intents/:id`, `POST /v1/subscriptions`, `GET /v1/subscriptions/:id`, `POST /v1/invoices`, `GET /v1/invoices/:id`

## Custom services

Use `Service.from` (or its alias `custom`) to define a service for any upstream API.

### With `bearer` shorthand

```ts twoslash [server.ts]
import { Proxy, Service } from 'mppx/proxy'
import { Mppx, tempo } from 'mppx/server'

const mppx = Mppx.create({ methods: [tempo()] })

const proxy = Proxy.create({
  services: [
    Service.from('my-api', {
      baseUrl: 'https://api.example.com',
      bearer: process.env.MY_API_KEY!,
      description: 'Example upstream API',
      title: 'My API',
      routes: {
        'POST /v1/generate': mppx.charge({ amount: '0.01' }),
        'GET /v1/status': true,
      },
    }),
  ],
})
```

### With `headers` shorthand

```ts [server.ts]
import { Service } from 'mppx/proxy'

Service.from('custom-api', {
  baseUrl: 'https://api.example.com',
  headers: {
    'X-API-Key': process.env.CUSTOM_API_KEY!,
    'X-Org-Id': 'org-123',
  },
  routes: {
    'POST /v1/query': mppx.charge({ amount: '0.02' }),
  },
})
```

### With `rewriteRequest`

For full control over the upstream request, use `rewriteRequest`. The context includes per-endpoint options set via the `options` field on an endpoint definition.

```ts [server.ts]
import { Service } from 'mppx/proxy'

Service.from('advanced-api', {
  baseUrl: 'https://api.example.com',
  rewriteRequest(request, ctx) {
    request.headers.set('Authorization', `Token ${process.env.API_TOKEN}`)
    return request
  },
  routes: {
    'POST /v1/generate': mppx.charge({ amount: '0.05' }),
  },
})
```

## Discovery endpoints

The proxy automatically serves discovery endpoints that describe available services and their routes. Coding agents and CLI tools use these endpoints to understand what the proxy offers.

| Endpoint | Content-Type | Description |
|----------|--------------|-------------|
| `GET /discover` | `application/json` or `text/plain` | Lists all services. Returns JSON by default, markdown for AI user agents and terminal clients. |
| `GET /discover/{id}` | `application/json` or `text/markdown` | Details for a single service, including routes and pricing. |
| `GET /discover/{id}.md` | `text/markdown` | Markdown description of a single service. |
| `GET /discover/all` | `application/json` or `text/markdown` | All services with full route details. |
| `GET /discover/all.md` | `text/markdown` | Markdown listing of all services and routes. |
| `GET /llms.txt` | `text/plain` | `llms.txt`-formatted overview of the proxy and its services. |
| `GET /discover.md` | `text/plain` | Alias for `/llms.txt`. |

The proxy returns markdown instead of JSON when the request comes from a known AI user agent (for example, `ChatGPT-User`, `ClaudeBot`, `PerplexityBot`) or a terminal client (for example, `curl`, `HTTPie`, `mppx`).

## Parameters

### `Proxy.create` config

### basePath (optional)

* **Type:** `string`

Base path prefix to strip before routing (for example, `'/api/proxy'`). Use when the proxy is mounted at a sub-path.

### description (optional)

* **Type:** `string`

Short description of the proxy shown in `llms.txt` and discovery endpoints.

### fetch (optional)

* **Type:** `typeof globalThis.fetch`

Custom `fetch` implementation. Defaults to `globalThis.fetch`.

### services

* **Type:** `Service[]`

Array of service definitions to proxy. Each service is mounted at `/{serviceId}/`.

### title (optional)

* **Type:** `string`

Human-readable title for the proxy shown in `llms.txt` and discovery endpoints.

## Service type reference

### `Service.from` config

### baseUrl

* **Type:** `string`

Base URL of the upstream service (for example, `'https://api.openai.com'`).

### bearer (optional)

* **Type:** `string`

Shorthand: injects `Authorization: Bearer {token}` header on upstream requests.

### description (optional)

* **Type:** `string`

Short description of the service, shown in discovery endpoints.

### docsLlmsUrl (optional)

* **Type:** `string | ((options: { route?: string }) => string | undefined)`

Documentation URL for the service. Provide a string for a static URL, or a function that receives an optional route pattern and returns a per-endpoint docs URL.

### headers (optional)

* **Type:** `Record<string, string>`

Shorthand: injects custom headers on upstream requests.

### mutate (optional)

* **Type:** `(req: Request) => Request | Promise<Request>`

Shorthand: full request mutation function. Takes priority over `bearer` and `headers`.

### rewriteRequest (optional)

* **Type:** `(req: Request, ctx: Context) => Request | Promise<Request>`

Hook to modify the upstream request before sending. Receives per-endpoint options via `ctx`.

### routes

* **Type:** `EndpointMap`

Map of `"METHOD /pattern"` keys to endpoint definitions. Each value is one of:

* **`IntentHandler`** — Payment required. The handler issues a `402` Challenge or verifies payment.
* **`{ pay: IntentHandler, options: EndpointOptions }`** — Payment required with per-endpoint config overrides passed to `rewriteRequest` via `ctx`.
* **`true`** — Free passthrough. No payment required; `rewriteRequest` is still applied.

### title (optional)

* **Type:** `string`

Human-readable title for the service (for example, `'OpenAI'`).

# `McpClient.wrap` \[Payment-aware MCP client]

Wraps an MCP SDK client with automatic payment handling. When a tool call returns a `-32042` payment required error, the wrapper creates a Credential and retries the call.

## Usage

```ts
import { Client } from '@modelcontextprotocol/sdk/client'
import { McpClient, tempo } from 'mppx/mcp-sdk/client'
import { privateKeyToAccount } from 'viem/accounts'

const client = new Client({ name: 'my-client', version: '1.0.0' })
await client.connect(transport)

const mcp = McpClient.wrap(client, {
  methods: [tempo({ account: privateKeyToAccount('0x...') })],
})

const result = await mcp.callTool({ name: 'premium_tool', arguments: {} })
// @log: { content: [...], receipt: { ... } }
```

### With call options

Pass `context` and `timeout` through the second argument to `callTool`.

```ts
const result = await mcp.callTool(
  { name: 'premium_tool', arguments: { query: 'hello' } },
  { context: { foo: 'bar' }, timeout: 30_000 },
)
```

## Return type

`McpClient.wrap` returns an object that spreads the original client and overrides `callTool` with a payment-aware version.

```ts
type McpClient<client, methods> = Omit<client, 'callTool'> & {
  callTool: (
    params: {
      arguments?: Record<string, unknown>
      name: string
      _meta?: Record<string, unknown>
    },
    options?: CallToolOptions<methods>,
  ) => Promise<CallToolResult>
}
```

The `CallToolResult` type extends the SDK's return type with a `receipt` field:

```ts
type CallToolResult = Awaited<ReturnType<Client['callTool']>> & {
  receipt: Mcp.Receipt | undefined
}
```

## Parameters

### client

* **Type:** `Pick<Client, 'callTool'>`

The MCP SDK client instance to wrap. Must have a `callTool` method—typically an instance of `Client` from `@modelcontextprotocol/sdk/client`.

### config.methods

* **Type:** `readonly Method.AnyClient[]`

Array of payment methods to use when handling payment Challenges. The wrapper matches Challenges from the server against installed methods by name and intent.

# `stripe` \[Register all Stripe intents]

Convenience function that creates the Stripe `charge` method intent.

## Usage

```ts twoslash

import { loadStripe } from '@stripe/stripe-js'
import { Mppx, stripe } from 'mppx/client'

const stripeJs = (await loadStripe('pk_test_...'))!

Mppx.create({
  methods: [
    // [!code focus:start]
    stripe({
      client: stripeJs,
      createToken: async (params) => {
        const res = await fetch('/api/create-spt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(params),
        })
        return (await res.json()).spt
      },
      paymentMethod: 'pm_card_visa',
    }),
    // [!code focus:end]
  ],
})
```

## Return type

```ts
import type { Method } from 'mppx'

type ReturnType = Method.Client
```

## Parameters

See [`stripe.charge`](/sdk/typescript/client/Method.stripe.charge) for the full parameter list.

# `Method.stripe.charge` \[One-time payments via Shared Payment Tokens]

Creates a Stripe charge payment method for client-side SPT-based payments.

## Usage

```ts twoslash

import { loadStripe } from '@stripe/stripe-js'
import { Mppx, stripe } from 'mppx/client'

const stripeJs = (await loadStripe('pk_test_...'))!

Mppx.create({
  methods: [
    // [!code focus:start]
    stripe.charge({
      client: stripeJs,
      createToken: async ({ amount, currency, expiresAt, metadata, networkId, paymentMethod }) => {
        const res = await fetch('/api/create-spt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount, currency, expiresAt, metadata, networkId, paymentMethod }),
        })
        return (await res.json()).spt
      },
    }),
    // [!code focus:end]
  ],
})
```

## Return type

```ts
import type { Method } from 'mppx'

type ReturnType = Method.Client
```

## Parameters

### client (optional)

* **Type:** `StripeJs`

Stripe.js instance from `@stripe/stripe-js`. Forwarded to the `createToken` callback for use with Stripe Elements.

```ts twoslash

import { loadStripe } from '@stripe/stripe-js'
import { stripe } from 'mppx/client'

const stripeJs = (await loadStripe('pk_test_...'))!

const method = stripe.charge({
  client: stripeJs, // [!code focus]
  createToken: async (params) => '...',
})
```

### createToken

* **Type:** `(params: OnChallengeParameters) => Promise<string>`

Callback invoked when a Stripe challenge is received. Must return an SPT token string (`spt_...`). Typically proxied through a server endpoint since SPT creation requires a Stripe secret key.

The callback receives:

| Field | Type | Description |
| --- | --- | --- |
| `amount` | `string` | Payment amount in smallest currency unit |
| `challenge` | `Challenge` | The parsed Challenge from the server |
| `client` | `StripeJs \| undefined` | Stripe.js instance, if provided |
| `currency` | `string` | Three-letter ISO currency code |
| `expiresAt` | `number` | SPT expiration as a Unix timestamp (seconds) |
| `metadata` | `Record<string, string>` | Optional metadata from the Challenge |
| `networkId` | `string \| undefined` | Stripe Business Network profile ID |
| `paymentMethod` | `string \| undefined` | Stripe payment method ID |

### externalId (optional)

* **Type:** `string`

Client reference ID included in the Credential payload.

### paymentMethod (optional)

* **Type:** `string`

Default Stripe payment method ID (e.g. `pm_card_visa`). Overridden by `context.paymentMethod` at credential-creation time.

```ts twoslash

import { stripe } from 'mppx/client'

const method = stripe.charge({
  createToken: async (params) => '...',
  paymentMethod: 'pm_card_visa', // [!code focus]
})
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

### Standalone session manager

`tempo.session()` also creates a standalone session manager with explicit `.fetch()`, `.close()`, and `.sse()` methods—no `Mppx.create` required:

```ts twoslash
import { tempo } from 'mppx/client'
import { privateKeyToAccount } from 'viem/accounts'

const session = tempo.session({
  account: privateKeyToAccount('0x...'),
  maxDeposit: '1',
})

const res = await session.fetch('https://api.example.com/resource')
await session.close()
```

See [`tempo.session` manager](/sdk/typescript/client/Method.tempo.session-manager) for the full API.

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

### autoSwap (optional)

* **Type:** `boolean | { tokenIn?: Address[]; slippage?: number }`

Automatically swap from a supported stablecoin (USDC.e, pathUSD) via the Tempo DEX precompile when the client lacks sufficient balance of the requested currency.

Pass `true` to enable, or an object for custom tokens and slippage.

```ts twoslash
import { tempo } from 'mppx/client'
import { privateKeyToAccount } from 'viem/accounts'

const method = tempo.charge({
  account: privateKeyToAccount('0xabc…123'),
  autoSwap: true, // [!code focus]
})
```

### clientId (optional)

* **Type:** `string`

Client identifier used to derive the client fingerprint in attribution memos.

### getClient (optional)

* **Type:** `(parameters: { chainId: number }) => MaybePromise<Client>`

Function that returns a viem client for the given chain ID.

### mode (optional)

* **Type:** `'push' | 'pull'`
* **Default:** `'push'` for JSON-RPC accounts, `'pull'` for local accounts

Controls how the charge transaction is submitted.

* `'push'`: the client broadcasts the transaction and sends the transaction hash to the server for verification.
* `'pull'`: the client signs the transaction and sends the serialized transaction to the server, which broadcasts it. This is required for server-side [fee sponsorship](/quickstart/server#fee-sponsorship).

```ts twoslash
import { tempo } from 'mppx/client'
import { privateKeyToAccount } from 'viem/accounts'

const method = tempo.charge({
  account: privateKeyToAccount('0xabc…123'),
  mode: 'pull', // [!code focus]
})
```

# `Method.tempo.session` \[Low-cost high-throughput payments]

Creates a Tempo payment session method for client-side voucher signing. Pass the result to `Mppx.create` for automatic 402 handling.

:::info
For standalone session management with explicit `.fetch()`, `.close()`, and `.sse()` methods, see [`tempo.session` manager](/sdk/typescript/client/Method.tempo.session-manager).
:::

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

```ts twoslash
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

# `tempo.session` \[Standalone session manager]

Creates a standalone session manager that handles the full payment channel lifecycle—open, fetch, stream, and close—without `Mppx.create` or `Fetch.from`.

Use this when you need direct control over session state instead of automatic 402 handling.

## Usage

```ts twoslash
import { tempo } from 'mppx/client'
import { privateKeyToAccount } from 'viem/accounts'

const account = privateKeyToAccount('0x...')

const session = tempo.session({
  account,
  maxDeposit: '1',
})

// Make a paid request — opens a channel on first call
const response = await session.fetch('https://api.example.com/resource')
console.log(response.status)
// @log: 200

// Access payment metadata
console.log(response.receipt)
console.log(response.cumulative)

// Close the channel and settle on-chain
const receipt = await session.close()
```

:::warning
Channels remain open until you call `session.close()`. Always close sessions when done to settle on-chain and reclaim unspent deposit.
:::

### Session resumption

All channel state is held in memory. If the client process restarts, the session is lost and a new on-chain channel opens on the next request—the previous channel's deposit is orphaned until manually closed.

When the server includes a `channelId` in the `402` Challenge, the client attempts to recover the channel by reading its on-chain state. If the channel has a positive deposit and is not finalized, it resumes from the on-chain settled amount.

### With SSE streaming

Stream server-sent events with automatic voucher handling. The session signs incremental vouchers as the server requests them during the stream.

```ts twoslash
import { tempo } from 'mppx/client'
import { privateKeyToAccount } from 'viem/accounts'

const session = tempo.session({
  account: privateKeyToAccount('0x...'),
  maxDeposit: '5',
})

const stream = await session.sse('https://api.example.com/stream', {
  onReceipt(receipt) {
    console.log('Receipt:', receipt)
  },
  signal: AbortSignal.timeout(30_000),
})

for await (const message of stream) {
  console.log(message)
}

await session.close()
```

### With explicit open

Open the channel before the first request. This separates the on-chain deposit transaction from the first API call.

```ts twoslash
import { tempo } from 'mppx/client'
import { privateKeyToAccount } from 'viem/accounts'

const account = privateKeyToAccount('0x...')

const session = tempo.session({
  account,
  maxDeposit: '10',
})

// Trigger a 402 to receive the challenge
await session.fetch('https://api.example.com/resource')

// Open the channel explicitly
await session.open()

// Subsequent requests use the open channel
const response = await session.fetch('https://api.example.com/resource')
```

## Return type

`tempo.session()` returns a `SessionManager` object:

```ts
type SessionManager = {
  readonly channelId: Hex | undefined
  readonly cumulative: bigint
  readonly opened: boolean
  open(options?: { deposit?: bigint }): Promise<void>
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<PaymentResponse>
  sse(
    input: RequestInfo | URL,
    init?: RequestInit & {
      onReceipt?: (receipt: SessionReceipt) => void
      signal?: AbortSignal
    },
  ): Promise<AsyncIterable<string>>
  close(): Promise<SessionReceipt | undefined>
}
```

### `PaymentResponse`

`session.fetch()` returns a standard `Response` extended with payment metadata:

```ts
type PaymentResponse = Response & {
  receipt: SessionReceipt | null
  challenge: Challenge | null
  channelId: Hex | null
  cumulative: bigint
}
```

### `SessionReceipt`

The receipt returned by `session.close()` and available on `PaymentResponse.receipt`:

```ts
type SessionReceipt = {
  method: 'tempo'
  intent: 'session'
  status: 'success'
  timestamp: string
  /** Payment channel ID (not a transaction hash). */
  reference: string
  challengeId: string
  channelId: Hex
  /** Highest cumulative voucher amount accepted by the server. */
  acceptedCumulative: string
  /** Total amount spent in this session. */
  spent: string
  /** Number of units consumed (if the server tracks units). */
  units?: number
  /** On-chain settlement transaction hash. Present after close. */
  txHash?: Hex
}
```

:::info
The `reference` field contains the channel ID, not a transaction hash. To get the settlement transaction hash, read `txHash` from the receipt returned by `session.close()`.
:::

## Parameters

### account (optional)

* **Type:** `Account`

Account to sign vouchers with.

### authorizedSigner (optional)

* **Type:** `Address`

Address authorized to sign vouchers. Defaults to the account address. Use when a separate access key signs vouchers while the root account funds the channel.

### client (optional)

* **Type:** `Client`

Viem client instance. Shorthand for `getClient: () => client`.

### decimals (optional)

* **Type:** `number`
* **Default:** `6`

Token decimals for parsing human-readable amounts like `maxDeposit`.

### escrowContract (optional)

* **Type:** `Address`

Escrow contract address override. Derived from the server Challenge if not provided.

### fetch (optional)

* **Type:** `typeof globalThis.fetch`
* **Default:** `globalThis.fetch`

Custom fetch function to use for requests.

### getClient (optional)

* **Type:** `(parameters: { chainId: number }) => MaybePromise<Client>`

Function that returns a viem client for the given chain ID.

### maxDeposit (optional)

* **Type:** `string`

Maximum deposit in human-readable units (for example `"10"` for 10 tokens). Caps the server's suggested deposit and enables automatic channel management.

## Methods

### `session.close()`

Closes the payment channel and settles on-chain. Returns the final `SessionReceipt` if available, or `undefined` if no channel was open.

```ts
const receipt = await session.close()
```

### `session.fetch(input, init?)`

Makes a payment-aware request. Handles the 402 Challenge → Credential flow automatically, opening a channel on first use if needed.

Returns a [`PaymentResponse`](#paymentresponse) with payment metadata attached.

```ts
const response = await session.fetch('https://api.example.com/resource')
console.log(response.receipt)
console.log(response.cumulative)
```

### `session.open(options?)`

Opens the payment channel explicitly. You must make at least one `fetch()` or `sse()` call first to receive a 402 Challenge from the server.

* **options.deposit** (`bigint`, optional) — Raw deposit amount in token units.

```ts
await session.fetch('https://api.example.com/resource')
await session.open()
```

### `session.sse(input, init?)`

Opens a server-sent events stream with automatic voucher signing. The server requests incremental vouchers via `payment-need-voucher` events, and the session signs them transparently.

Returns an `AsyncIterable<string>` of message payloads.

* **init.onReceipt** (`(receipt: SessionReceipt) => void`, optional) — Called when the server sends a payment Receipt during the stream.
* **init.signal** (`AbortSignal`, optional) — Aborts the stream.

```ts
const stream = await session.sse('https://api.example.com/stream', {
  onReceipt: (receipt) => console.log('paid:', receipt),
  signal: AbortSignal.timeout(60_000),
})

for await (const message of stream) {
  console.log(message)
}
```

## Properties

### `session.channelId`

* **Type:** `Hex | undefined`

The on-chain channel ID after the channel opens. `undefined` before the first successful payment.

### `session.cumulative`

* **Type:** `bigint`

The cumulative amount paid across all vouchers in this session. Starts at `0n`.

### `session.opened`

* **Type:** `boolean`

Whether the payment channel is currently open.

# `Mppx.create` \[Create a payment-aware fetch client]

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
  methods: [tempo({ account })],
  polyfill: false, // [!code hl]
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
  methods: [tempo()],
  polyfill: false, // [!code hl]
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
  /** The original, unwrapped fetch — bypasses payment interception. */
  rawFetch: typeof globalThis.fetch
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

### `rawFetch`

The original `fetch` function, before payment interception. Use `rawFetch` when you need to make requests that bypass the 402 handler—for example, probing a 402 endpoint for websocket auth tokens or calling APIs that return 402 for non-payment reasons.

```ts twoslash
import { Mppx, tempo } from 'mppx/client'
import { privateKeyToAccount } from 'viem/accounts'

const account = privateKeyToAccount('0x...')

const mppx = Mppx.create({
  polyfill: false,
  methods: [tempo({ account })],
})

// Bypass payment interception
const raw = await mppx.rawFetch('https://api.example.com/ws-auth') // [!code focus]
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
  methods: [tempo({ account })],
  polyfill: false, // [!code focus]
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

# `Mppx.restore` \[Restore the original global fetch]

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

# `Transport.from` \[Create a custom transport]

Creates a custom client-side transport.

## Usage

```ts twoslash
import { Challenge } from 'mppx'
import { Transport } from 'mppx/client'

const http = Transport.from<RequestInit, Response>({
  getChallenge(response) {
    return Challenge.fromResponse(response)
  },
  isPaymentRequired(response) {
    return response.status === 402
  },
  name: 'http',
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

# `Transport.http` \[HTTP transport for payments]

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

# `Transport.mcp` \[MCP transport for payments]

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

# `BodyDigest.compute` \[Compute a body digest hash]

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

# `BodyDigest.verify` \[Verify a body digest hash]

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

# `Challenge.deserialize` \[Deserialize a Challenge from a header]

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

# `Challenge.from` \[Create a new Challenge]

Creates a challenge from the given parameters.

If `secretKey` option is provided, the challenge ID is computed as HMAC-SHA256 over the challenge parameters (realm|method|intent|request|expires|digest|opaque), cryptographically binding the ID to its contents.

## Usage

```ts twoslash
import { Challenge } from 'mppx'

// With HMAC-bound ID (recommended for servers)
const challenge = Challenge.from(
  {
    intent: 'charge',
    method: 'tempo',
    realm: 'mpp.dev',
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
  intent: 'charge',
  method: 'tempo',
  realm: 'mpp.dev',
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

# `Challenge.fromHeaders` \[Extract a Challenge from Headers]

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

# `Challenge.fromMethod` \[Create a Challenge from a method]

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

# `Challenge.fromResponse` \[Extract a Challenge from a Response]

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

### options (optional)

* **Type:** `{ methods?: readonly Method.Method[] }`

Optional settings to narrow the Challenge type using method intents.

### response

* **Type:** `Response`

The HTTP response (must be `402` status).

# `Challenge.meta` \[Extract correlation data from a Challenge]

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

# `Challenge.serialize` \[Serialize a Challenge to a header]

Serializes a challenge to the WWW-Authenticate header format.

## Usage

```ts twoslash
import { Challenge } from 'mppx'

const challenge = Challenge.from({
  id: 'abc123',
  intent: 'charge',
  method: 'tempo',
  realm: 'mpp.dev',
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

# `Challenge.verify` \[Verify a Challenge HMAC]

Verifies that a challenge ID matches the expected HMAC for the given parameters.

## Usage

```ts twoslash
import { Challenge } from 'mppx'

const challenge = Challenge.from({
  intent: 'charge',
  method: 'tempo',
  realm: 'mpp.dev',
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

# `Credential.deserialize` \[Deserialize a Credential from a header]

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

# `Credential.from` \[Create a new Credential]

Creates a credential from the given parameters.

## Usage

```ts twoslash
import { Credential, Challenge } from 'mppx'

const challenge = Challenge.from({
  id: 'abc123',
  intent: 'charge',
  method: 'tempo',
  realm: 'mpp.dev',
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

# `Credential.fromRequest` \[Extract a Credential from a Request]

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

# `Credential.serialize` \[Serialize a Credential to a header]

Serializes a credential to the Authorization header format.

## Usage

```ts twoslash
import { Credential, Challenge } from 'mppx'

const challenge = Challenge.from({
  id: 'abc123',
  intent: 'charge',
  method: 'tempo',
  realm: 'mpp.dev',
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

# `Expires` \[Generate relative expiration timestamps]

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

# `Method.from` \[Create a payment method definition]

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

# `Method.toClient` \[Extend a method with client logic]

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

# `Method.toServer` \[Extend a method with server verification]

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

# `PaymentRequest.deserialize` \[Deserialize a payment request]

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

# `PaymentRequest.from` \[Create a payment request]

Creates a payment request from the given parameters.

## Usage

```ts twoslash
import { PaymentRequest } from 'mppx'

const request = PaymentRequest.from({
  amount: '1000000',
  currency: '0x20c0000000000000000000000000000000000000',
  recipient: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
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

# `PaymentRequest.serialize` \[Serialize a payment request to a string]

Serializes a payment request to a base64url string.

## Usage

```ts twoslash
import { PaymentRequest } from 'mppx'

const request = PaymentRequest.from({
  amount: '1000000',
  currency: '0x20c0000000000000000000000000000000000000',
  recipient: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
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

# `Receipt.deserialize` \[Deserialize a Receipt from a header]

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

# `Receipt.from` \[Create a new Receipt]

Creates a receipt from the given parameters.

## Usage

```ts twoslash
import { Receipt } from 'mppx'

const receipt = Receipt.from({
  method: 'tempo',
  reference: '0x...',
  status: 'success',
  timestamp: new Date().toISOString(),
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

# `Receipt.fromResponse` \[Extract a Receipt from a Response]

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

# `Receipt.serialize` \[Serialize a Receipt to a string]

Serializes a receipt to the Payment-Receipt header format.

## Usage

```ts twoslash
import { Receipt } from 'mppx'

const receipt = Receipt.from({
  method: 'tempo',
  reference: '0x...',
  status: 'success',
  timestamp: new Date().toISOString(),
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

### Identifying the payer

After the middleware verifies payment, the `Authorization` header is still on the request. Parse it with `Credential.deserialize` to read the payer's identity from the `source` field—a DID such as `did:pkh:eip155:1:0x...`.

```ts [server.ts]
import express from 'express'
import { Credential } from 'mppx'
import { Mppx, tempo } from 'mppx/express'

const app = express()
const mppx = Mppx.create({ methods: [tempo()] })

app.get(
  '/premium',
  mppx.charge({ amount: '1' }),
  (req, res) => {
    const credential = Credential.deserialize(req.headers.authorization!)
    const payer = credential.source // "did:pkh:eip155:1:0x..."
    res.json({ payer })
  },
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

### Identifying the payer

After the middleware verifies payment, the `Authorization` header is still on the request. Parse it with `Credential.deserialize` to read the payer's identity from the `source` field—a DID such as `did:pkh:eip155:1:0x...`.

```ts [server.ts]
import { Hono } from 'hono'
import { Credential } from 'mppx'
import { Mppx, tempo } from 'mppx/hono'

const app = new Hono()
const mppx = Mppx.create({ methods: [tempo()] })

app.get(
  '/premium',
  mppx.charge({ amount: '1' }),
  (c) => {
    const credential = Credential.deserialize(c.req.header('Authorization')!)
    const payer = credential.source // "did:pkh:eip155:1:0x..."
    return c.json({ payer })
  },
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

```ts twoslash [app/api/premium/route.ts]
import { Mppx, tempo } from 'mppx/nextjs'

const mppx = Mppx.create({ methods: [tempo()] }) // [!code hl]

export const GET = 
  mppx.charge({ amount: '1' }) // [!code hl]
  (() => Response.json({ data: 'paid content' }))
```

### Session payments

Use `mppx.session()` to gate routes behind session-based payment intents.

```ts twoslash [app/api/content/route.ts]
import { Mppx, tempo } from 'mppx/nextjs'

const mppx = Mppx.create({ methods: [tempo()] })

export const GET =
  mppx.session({ amount: '1', unitType: 'token' })
  (() => Response.json({ data: 'session content' }))
```

### Identifying the payer

After the handler verifies payment, the `Authorization` header is still on the request. Parse it with `Credential.deserialize` to read the payer's identity from the `source` field—a DID such as `did:pkh:eip155:1:0x...`.

```ts twoslash [app/api/premium/route.ts]
import { Credential } from 'mppx'
import { Mppx, tempo } from 'mppx/nextjs'

const mppx = Mppx.create({ methods: [tempo()] })

export const GET =
  mppx.charge({ amount: '1' })
  ((request) => {
    const credential = Credential.deserialize(request.headers.get('Authorization')!)
    const payer = credential.source // "did:pkh:eip155:1:0x..."
    return Response.json({ payer })
  })
```

# `stripe` \[Register all Stripe intents]

Convenience function that creates the Stripe `charge` method intent.

## Usage

```ts twoslash

import Stripe from 'stripe'
import { Mppx, stripe } from 'mppx/server'

const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY!)

Mppx.create({
  methods: [
    // [!code focus:start]
    stripe({
      client: stripeClient,
      networkId: 'internal',
      paymentMethodTypes: ['card'],
    }),
    // [!code focus:end]
  ],
})
```

## Return type

```ts
import type { Method } from 'mppx'

type ReturnType = Method.Server
```

## Parameters

See [`stripe.charge`](/sdk/typescript/server/Method.stripe.charge) for the full parameter list.

# `Method.stripe.charge` \[One-time payments via Shared Payment Tokens]

The `charge` intent for the Stripe payment method. Requests a one-time payment using [Shared Payment Tokens (SPTs)](https://docs.stripe.com/agentic-commerce/concepts/shared-payment-tokens).

## Usage

```ts twoslash

import Stripe from 'stripe'
import { Mppx, stripe } from 'mppx/server'

const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY!)

const mppx = Mppx.create({
  methods: [stripe.charge({
    client: stripeClient,
    networkId: 'internal',
    paymentMethodTypes: ['card'],
  })],
})

export async function handler(request: Request) {
  // [!code focus:start]
  const response = await mppx.charge({
    amount: '1',
    currency: 'usd',
    decimals: 2,
    description: 'Premium API access',
  })(request)
  // [!code focus:end]

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

These parameters configure the `stripe.charge()` constructor. You must provide either `client` or `secretKey`.

### client

* **Type:** `StripeClient`

Pre-configured Stripe SDK instance. Any object matching the duck-typed `StripeClient` shape works. Using `client` is recommended—it lets you configure retries, API version, and other options.

```ts twoslash

import Stripe from 'stripe'
import { stripe } from 'mppx/server'

const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY!)

const method = stripe.charge({
  client: stripeClient, // [!code focus]
  networkId: 'internal',
  paymentMethodTypes: ['card'],
})
```

### secretKey

* **Type:** `string`

Stripe secret API key. When provided instead of `client`, mppx makes raw API calls to Stripe.

```ts twoslash
import { stripe } from 'mppx/server'

const method = stripe.charge({
  secretKey: process.env.STRIPE_SECRET_KEY!, // [!code focus]
  networkId: 'internal',
  paymentMethodTypes: ['card'],
})
```

### networkId

* **Type:** `string`

Stripe [Business Network](https://docs.stripe.com/get-started/account/profile) profile ID.

### paymentMethodTypes

* **Type:** `string[]`

Allowed Stripe payment method types (for example, `['card']`, `['card', 'link']`).

### metadata (optional)

* **Type:** `Record<string, string>`

Key-value pairs forwarded to Stripe. Appears in the Challenge and attaches to the Stripe `PaymentIntent`.

## Request parameters

### amount

* **Type:** `string`

Payment amount in human-readable units.

### currency

* **Type:** `string`

ISO currency code (for example, `'usd'`).

### decimals

* **Type:** `number`

Number of decimal places in the amount (for example, `2` for cents).

### description (optional)

* **Type:** `string`

Human-readable description of the payment request.

# `tempo` \[Register all Tempo intents]

Convenience function that creates both `tempo.charge` and `tempo.session` method intents with shared configuration.

## Usage

```ts twoslash
import { Mppx, tempo } from 'mppx/server'

Mppx.create({
  methods: [
    // [!code focus:start]
    tempo(),
    // [!code focus:end]
  ],
})
```

This is equivalent to:

```ts twoslash
import { Mppx, tempo } from 'mppx/server'

Mppx.create({
  methods: [
    tempo.charge(),
    tempo.session(),
  ],
})
```

## Return type

```ts
type ReturnType = readonly [Method.Server, Method.Server]
```

A tuple of `[charge, session]` methods. `Mppx.create` accepts tuples in the `methods` array and flattens them automatically.

## Parameters

Accepts the union of [`tempo.charge`](/sdk/typescript/server/Method.tempo.charge) and [`tempo.session`](/sdk/typescript/server/Method.tempo.session) parameters. The most common are listed below.

### currency (optional)

* **Type:** `Address`

Default TIP-20 token address for the payment currency.

### decimals (optional)

* **Type:** `number`
* **Default:** `6`

Decimal places for amount parsing.

### feePayer (optional)

* **Type:** `Account | string | true`

Account or URL for sponsoring transaction fees. Pass a viem `Account` to co-sign locally, a URL string to delegate to a remote [fee payer service](https://docs.tempo.xyz/sdk/typescript/server/handler.feePayer), or `true` when the `account` parameter doubles as the fee payer.

### getClient (optional)

* **Type:** `(parameters: { chainId?: number }) => MaybePromise<Client>`

Function that returns a viem client for the given chain ID. Overrides the default RPC configuration.

### recipient (optional)

* **Type:** `Address`

Default recipient address for payments.

### testnet (optional)

* **Type:** `boolean`

Testnet mode. Defaults the chain ID to `42431` (Tempo testnet).

# `Method.tempo.charge` \[One-time stablecoin payments]

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
    recipient: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
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
    recipient: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
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
    recipient: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
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

* **Type:** `Account | string | true`

Account or URL for sponsoring transaction fees. Pass a viem `Account` to co-sign locally, a URL string to delegate to a remote [fee payer service](https://docs.tempo.xyz/sdk/typescript/server/handler.feePayer), or `true` when the `account` parameter doubles as the fee payer.

### getClient (optional)

* **Type:** `(parameters: { chainId?: number }) => MaybePromise<Client>`

Function that returns a viem client for the given chain ID. Overrides the default RPC configuration.

### memo (optional)

* **Type:** `string`

On-chain memo for the transaction.

### testnet (optional)

* **Type:** `boolean`

Testnet mode. Defaults the chain ID to `42431` (Tempo testnet).

### waitForConfirmation (optional)

* **Type:** `boolean`
* **Default:** `true`

Whether to wait for the charge transaction to confirm on-chain before responding. When `false`, the transaction is simulated via `eth_estimateGas` and broadcast without waiting for inclusion. The Receipt optimistically reports `status: 'success'` based on simulation alone.

```ts twoslash
import { Mppx, tempo } from 'mppx/server'

const mppx = Mppx.create({
  methods: [tempo.charge({
    waitForConfirmation: false, // [!code focus]
  })],
})
```

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
import { privateKeyToAccount } from 'viem/accounts'

const mppx = Mppx.create({
  // [!code focus:start]
  methods: [
    tempo.session({
      account: privateKeyToAccount('0x...'),
      currency: '0x20c0000000000000000000000000000000000000',
    }),
  ],
  // [!code focus:end]
})
```

### With charge and session

Register both intents on a single server.

```ts twoslash
import { Mppx, tempo } from 'mppx/server'
import { privateKeyToAccount } from 'viem/accounts'

const account = privateKeyToAccount('0x...')

const mppx = Mppx.create({
  methods: [
    tempo.charge({ account }),
    tempo.session({ account }),
  ],
})
```

## Return type

```ts
import type { Method } from 'mppx'

type ReturnType = Method.Server
```

## Parameters

### account

* **Type:** `Account`

Account used to close and settle payment channels on-chain. The account address is also used as the default recipient. Without this, channel close and settlement will fail.

### amount (optional)

* **Type:** `string`

Default amount to charge per unit.

### channelStateTtl (optional)

* **Type:** `number`
* **Default:** `60000`

TTL in milliseconds for cached on-chain channel state. After this duration, the server re-queries on-chain state during voucher handling to detect forced close requests.

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

* **Type:** `Account | string | true`

Account or URL for sponsoring open and top-up transaction fees. Pass a viem `Account` to co-sign locally, a URL string to delegate to a remote [fee payer service](https://docs.tempo.xyz/sdk/typescript/server/handler.feePayer), or `true` when the `account` parameter doubles as the fee payer.

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

### waitForConfirmation (optional)

* **Type:** `boolean`
* **Default:** `true`

Whether to wait for open transactions to confirm on-chain before responding. When `false`, the transaction is simulated and broadcast without waiting for inclusion.

## Related

### `tempo.settle`

One-shot settlement: reads the highest voucher from the store and submits it on-chain. Use this for periodic batch settlement outside the request handler.

```ts
import { tempo } from 'mppx/server'
import { Store } from 'mppx/server'
import { createClient, http } from 'viem'
import { tempo as tempoChain } from 'viem/chains'

const client = createClient({ chain: tempoChain, transport: http() })
const store = Store.memory()

// Settle a specific channel
const txHash = await tempo.settle(store, client, '0xchannelId...')
```

#### Parameters

* **store** — `ChannelStore` — The channel store instance.
* **client** — `Client` — A viem client for on-chain interaction.
* **channelId** — `Hex` — The channel to settle.
* **options.escrowContract** (optional) — `Address` — Escrow contract override.
* **options.feePayer** (optional) — `Account | string` — Fee payer account or relay URL.

#### Return type

* **Type:** `Hex` — The settlement transaction hash.

# `Mppx.compose` \[Present multiple payment options]

Combines multiple method handlers into a single route handler that presents all methods to the client via multiple `WWW-Authenticate` headers.

## Usage

Present both stablecoin and card payment options for a single endpoint. The client picks whichever method it supports.

```ts twoslash
import { Mppx, stripe, tempo } from 'mppx/server'

const pathUSD = '0x20c0000000000000000000000000000000000000'
const USDC = '0x20C000000000000000000000b9537d11c60E8b50'
const recipient = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'

const charge = tempo.charge({ recipient })
const card = stripe.charge({
  networkId: 'acct_1234',
  paymentMethodTypes: ['card'],
  secretKey: 'sk_live_...',
})

const mppx = Mppx.create({ methods: [charge, card] })

export async function handler(request: Request) {
  const result = await mppx.compose(
    [charge, { amount: '1', currency: pathUSD }],
    [charge, { amount: '1', currency: USDC }],
    [card, { amount: '1', currency: 'usd' }],
  )(request)

  if (result.status === 402) return result.challenge
  return result.withReceipt(Response.json({ data: '...' }))
}
```

## Behavior

* **No Credential present:** Calls all handlers and merges their `402` challenges into a single response with multiple `WWW-Authenticate` headers.
* **Credential present:** Dispatches to the handler matching the Credential's `method` and `intent`.

## Return type

```ts
type ReturnType = (input: Request) => Promise<
  | { status: 402; challenge: Response }
  | { status: 200; withReceipt: <T>(response: T) => T }
>
```

## Parameters

### ...entries

* **Type:** `readonly [Method.Server | string, Options][]`

Each entry is a tuple of a method reference (or string key like `"tempo/charge"`) and the request options for that method. Requires at least one entry.

# `Mppx.create` \[Create a server-side payment handler]

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
* **Default:** Auto-detected from `MPP_SECRET_KEY` environment variable. Throws if neither provided nor set.

Secret key for HMAC-bound challenge IDs. Enables stateless verification—the server verifies that a Challenge was issued by itself without storing state.

```ts twoslash
import { Mppx, tempo } from 'mppx/server'

const payment = Mppx.create({
  methods: [tempo()],
  secretKey: process.env.MPP_SECRET_KEY!, // [!code focus]
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

# `Mppx.toNodeListener` \[Adapt payments for Node.js HTTP]

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

* **On `402`:** Writes the Challenge response headers and body, then ends the connection.
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

# `Request.toNodeListener` \[Convert Fetch handlers to Node.js]

Converts a Fetch API handler into a Node.js HTTP request listener. Useful for running an MPP server on bare `node:http` without a framework.

## Usage

```ts
import http from 'node:http'
import { Mppx, Request, tempo } from 'mppx/server'

const mppx = Mppx.create({ methods: [tempo()] })

const server = http.createServer(
  Request.toNodeListener(mppx.request),
)

server.listen(3000)
```

### `Request.fromNodeListener`

Converts a Node.js `IncomingMessage`/`ServerResponse` pair into a Fetch API `Request`. Useful when you need to manually construct a `Request` inside existing Node.js middleware.

```ts
import type { IncomingMessage, ServerResponse } from 'node:http'
import { Request } from 'mppx/server'

function middleware(req: IncomingMessage, res: ServerResponse) {
  const request = Request.fromNodeListener(req, res)
  // handle as a Fetch API Request
}
```

## Parameters

### handler

* **Type:** `(request: Request) => Promise<Response> | Response`

A Fetch API handler that receives a `Request` and returns a `Response`.

### options (optional)

* **Type:** `RequestListenerOptions`

Options forwarded to the underlying adapter, including an optional error handler.

# `Response.requirePayment` \[Create a 402 response]

Creates a `402` Payment Required response with a `WWW-Authenticate: Payment` header. Optionally includes RFC 9457 Problem Details in the response body when an error is provided.

## Usage

```ts twoslash
import { Challenge } from 'mppx'
import { Response } from 'mppx/server'

const challenge = Challenge.from({
  id: 'challenge-123',
  method: 'tempo',
  intent: 'charge',
  realm: 'api.example.com',
  request: {
    amount: '1.00',
    currency: '0x20c0000000000000000000000000000000000000',
    recipient: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
  },
})

const response = Response.requirePayment({ challenge })
// @log: Response { status: 402, headers: { 'WWW-Authenticate': 'Payment ...' } }
```

## Return type

```ts
type ReturnType = Response
```

A standard `Response` with status `402` and a `WWW-Authenticate: Payment` header containing the serialized Challenge. When an `error` is provided, the body contains a JSON problem details object with `Content-Type: application/problem+json`.

## Parameters

### challenge

* **Type:** `Challenge`

The Challenge to serialize into the `WWW-Authenticate` header.

### error (optional)

* **Type:** `PaymentError`

An error to include as RFC 9457 Problem Details in the response body.

# `Transport.from` \[Create a custom transport]

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

Extracts Credential from the transport input. Returns `null` if no Credential was provided, or throws if malformed.

### name

* **Type:** `string`

Transport name for identification.

### respondChallenge

* **Type:** `(options: { challenge: Challenge; error?: PaymentError; input: Input }) => ChallengeOutput | Promise<ChallengeOutput>`

Creates a transport response for a payment challenge.

### respondReceipt

* **Type:** `(options: { challengeId: string; receipt: Receipt; response: ReceiptOutput }) => ReceiptOutput`

Attaches a receipt to a successful response.

# `Transport.http` \[HTTP server-side transport]

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

# `Transport.mcp` \[Raw JSON-RPC MCP transport]

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

# `Transport.mcpSdk` \[MCP SDK server-side transport]

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