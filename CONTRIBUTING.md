# Contributing to @agentcash/router

Thanks for your interest in contributing! This document covers the local setup,
the checks your change must pass, and how releases work.

## Setup

Requirements: Node 22 and [pnpm](https://pnpm.io) (the repo pins the version via
the `packageManager` field — `corepack enable` handles it).

```sh
pnpm install
pnpm build
pnpm test
```

## Making changes

- Start from `main` and open a pull request against `main`.
- Keep the guiding principles in [AGENTS.md](./AGENTS.md) in mind — notably:
  route definitions stay small, the route registry is the single source of
  truth, and protocol work is delegated to `@x402/*` / `mppx` rather than
  reimplemented.
- Add or update tests in `tests/` for any behavior change. Tests run with
  Vitest (`pnpm test`, or `pnpm test:watch` while developing).
- Update `README.md` / `AGENTS.md` if your change affects the public API or
  documented behavior.

## Before you push

CI runs `pnpm check`, which is:

```sh
pnpm format:check   # prettier
pnpm lint           # eslint, zero warnings
pnpm typecheck      # tsc --noEmit
pnpm knip           # unused exports/dependencies
pnpm build          # tsup
pnpm test           # vitest
```

Run it locally first. `pnpm format` and `pnpm lint:fix` fix most formatting and
lint issues automatically.

## Changesets

Releases are automated with [Changesets](https://github.com/changesets/changesets).
If your change affects the published package (features, fixes, breaking
changes), add a changeset in the same PR:

```sh
pnpm exec changeset
```

Pick the appropriate bump (`patch` for fixes, `minor` for features, `major`
for breaking changes) and write a short description — it becomes the
CHANGELOG entry. Internal-only changes (CI, docs, tests) don't need one.

When your PR merges, a release PR is opened automatically; merging that
publishes to npm.

## Reporting bugs and security issues

- Bugs and feature requests: open a GitHub issue with a minimal reproduction.
- Security vulnerabilities: **do not open a public issue** — see
  [SECURITY.md](./SECURITY.md).
