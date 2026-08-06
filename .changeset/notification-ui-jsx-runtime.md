---
'@adatechnology/notification-ui': patch
---

Fix: two packaging bugs that made the published bundle unusable

`0.1.0-rc.1` was unusable. Every consumer hit the error the moment `NotificationProvider`
mounted, because the bundle emitted classic-runtime `React.createElement` calls without importing
`React`.

The cause: `jsx: "react-jsx"` reached the package through `extends` from `tsconfig.base.json`, and
esbuild reads that option from the package's own tsconfig but **does not follow `extends`** to
resolve it. So `tsc` and `bun test` both agreed on the automatic runtime while the build silently
used the classic one. Making the package's tsconfig self-contained fixes it — the same reason
`conversations-ui` was never affected.

Why 19 passing tests missed it: they import the source, which bun transpiles with the automatic
runtime. Nothing looked at `dist`. `src/buildOutput.test.ts` now does, and it fails on exactly this
bug — verified by reverting the tsconfig and watching 4 of its 5 assertions break.

Found by mounting the package in a real host, which is the only place it could have surfaced.


**Second bug, same investigation:** `useUnreadCount` from `/headless` threw "componente usado fora de
`<NotificationProvider>`" while sitting inside one. With two entrypoints and `splitting: false`, tsup
inlines shared code into each — so `NotificationContext` existed twice, and a provider imported from
`.` could never feed a hook imported from `/headless`. `splitting: true` emits a shared chunk.

That one is structural, not incidental: splitting the package into components (`.`) and hooks
(`/headless`) is precisely what makes shared chunks mandatory. The build test now asserts both
entrypoints import the *same* chunk.
