---
'@adatechnology/notification-contracts': minor
'@adatechnology/notification-module': minor
---

Mount notification routes through `@adatechnology/module-http`

The generic HTTP plumbing — route dispatch, path matching, error filter, fetch and uWebSockets
adapters — moved to a shared package when the catalog module needed the same 698 lines. Keeping
two copies would have guaranteed divergence, which is exactly what extracting was meant to prevent.

**Breaking, though nothing consumes it yet:** the `./http/fetch` and `./http/uws` subpath exports
are gone. Hosts import `createModuleFetchRouter` (or `mountModuleRoutes`) from
`@adatechnology/module-http` and pass it the route table from `createNotificationRoutes`. This is
not a loss of convenience — a host running both modules now mounts **one router for both route
tables** instead of one adapter per module, so the glue gets smaller, and both modules are mounted
the same way.

The HTTP types also leave `notification-contracts`. There were three structurally identical
definitions of `AuthContext` across the two contracts packages and `module-http`; the package that
mounts routes should own them. The contracts package goes back to being domain only, and loses the
only reason it had to know the word "route".
