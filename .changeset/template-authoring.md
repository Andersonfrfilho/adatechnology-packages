---
'@adatechnology/notification-contracts': minor
'@adatechnology/notification-client': minor
'@adatechnology/notification-ui': minor
'@adatechnology/notification-module': patch
---

Template authoring from the UI: writable templates and a preview that cannot drift

Building the settings screen in a host exposed three gaps that made "let the shopkeeper edit the
copy" impossible from the frontend.

**The client could read templates but not write them.** `POST /notification-templates` existed and
worked; `NotificationClient` only had `listTemplates`. Added `upsertTemplate`, and `useUpsertTemplate`
alongside it in `/headless`. It invalidates rather than writing the cache optimistically: the server
assigns the version number, and showing "version 3" when the database recorded 4 confuses exactly the
person checking what they just saved.

**The interpolation lived only in the backend.** A settings screen needs to preview what the customer
will receive, and `notification-module` pulls in Drizzle — the frontend cannot import it.
Reimplementing `{{field}}` in each host would work today and drift tomorrow, and **a preview that
lies is worse than no preview**: someone saves the template trusting what they saw.

So the pure render moved to `notification-contracts` (zero dependencies) as `renderTemplate`,
`interpolateTemplate` and `extractTemplatePlaceholders`. The module now calls it — same behavior, one
implementation, read by the sender and by the preview. Divergence stops being possible instead of
being unlikely.

`extractTemplatePlaceholders` exists so the screen can ask for the fields a template actually
references, instead of the author guessing which ones the payload provides.
