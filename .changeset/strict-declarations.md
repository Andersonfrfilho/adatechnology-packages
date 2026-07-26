---
'@adatechnology/meta-whatsapp-contracts': patch
'@adatechnology/meta-whatsapp-module': patch
'@adatechnology/meta-whatsapp-provider': patch
'@adatechnology/meta-catalog-provider': patch
'@adatechnology/meta-graph-core': patch
'@adatechnology/nestjs-http-client': patch
'@adatechnology/nestjs-logger': patch
'@adatechnology/shared': patch
---

Fix published type declarations being emitted without `strict`

`tsconfig.base.json` never set `strict`, so tsup emitted every package's `.d.ts`
with `strictNullChecks` off. Under that setting zod's inference degrades and
required fields come out optional — `whatsAppMessageSchema` published
`body?: string` for a `z.ZodString`. Any consumer compiling with `strict: true`
(QuickCart does) got `Type 'string | undefined' is not assignable to type 'string'`
on fields that are not optional at all.

Turning strict on in the base config surfaced four latent bugs, now fixed:

- `shared`: two `catch (error)` blocks read `error.message` off `unknown`. When the
  thrown value is not an Error the catch itself throws, turning "optional tracing
  dependency is absent" into a hard crash.
- `shared`: `TraceMethodWithDI` read `this.traceStack` with `this` inferred from the
  enclosing descriptor rather than the decorated instance.
- `nestjs-http-client`: `options.cache.redisOptions` was read inside a `useFactory`
  closure where the enclosing `?.` narrowing no longer holds.
- `nestjs-logger`: `buildSampler` was typed as returning a required `Sampler` while
  deliberately returning `undefined` to fall back to the SDK default.

Adds a type-level regression test in contracts so declarations emitted without
strict fail the package check instead of shipping.
