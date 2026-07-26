---
'@adatechnology/meta-whatsapp-module': patch
---

Fix silently-empty conversation previews caused by an uncorrelated subquery

Inside a select projection drizzle renders `${sessions.companyId}` as a bare
`"company_id"`, without the table qualification. Inside the correlated subquery
that name resolves to the *message's* own column, so the filter became
`m.company_id = m.company_id` (always true) and `m.session_id = m.id` (never) —
no rows, NULL result, no error. The list came back with empty previews and a
permanent zero unread even though the data was there.

Correlating through `${sessions}.company_id` renders the qualified table name
and fixes it. The expressions are now exported so a test can render and assert
the correlation without a database, since nothing about this failure is visible
at runtime.
