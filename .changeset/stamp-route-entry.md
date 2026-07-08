---
'@agentcash/router': minor
---

Stamp the `RouteEntry` onto handlers returned by `.handler()` / `.stream()` under the exported `ROUTE_ENTRY` symbol (mppx-style).

Tooling can now ask an exported Next.js route handler "which route are you?" without reconciling file paths against registry keys — e.g. a barrel-completeness test can dynamic-import each `route.ts` and assert every HTTP-method export carries `handler[ROUTE_ENTRY]`, catching both forgotten barrel imports and files that never went through `router.route()`. The stamped entry is the same object the registry holds (introspect `key`, `pricing`, `authMode`, `protocols`, schemas). Uses `Symbol.for`, so it survives duplicate router copies in one process. New exports: `ROUTE_ENTRY`, `RegisteredRouteHandler`, `RouteEntry`.
