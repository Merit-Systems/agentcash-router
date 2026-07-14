# Security Policy

`@agentcash/router` handles payment verification and settlement (x402, MPP) and
wallet-based authentication (SIWX). We take vulnerabilities in these paths
seriously and appreciate responsible disclosure.

## Reporting a vulnerability

**Please do not open a public issue for security reports.**

Report vulnerabilities privately via
[GitHub Security Advisories](https://github.com/Merit-Systems/agentcash-router/security/advisories/new)
("Report a vulnerability" on the Security tab).

Include what you can:

- A description of the issue and its impact (e.g. payment bypass, settlement
  without verification, auth bypass, replay).
- Steps to reproduce or a proof of concept.
- The affected version(s) of `@agentcash/router`.

We will acknowledge reports within 3 business days, keep you informed as we
investigate, and credit you in the fix release unless you prefer otherwise.

## Supported versions

| Version    | Supported |
| ---------- | --------- |
| latest 1.x | ✅        |
| < 1.0      | ❌        |

Security fixes are released as patch versions of the latest minor. We do not
backport fixes to older minors.

## Scope notes

- Bugs that let a request reach a paid handler without a verified payment, or
  settle a payment that was never verified, are in scope and high severity.
- Vulnerabilities in upstream protocol packages (`@x402/*`, `@coinbase/x402`,
  `mppx`) should be reported to those projects; if the router *uses* them
  unsafely, that is in scope here.
- Issues requiring a compromised payee key or facilitator are generally out of
  scope.
