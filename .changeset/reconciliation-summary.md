---
'@adatechnology/identity-reconciliation': minor
---

Separate the two divergences: existing on one side only, and existing on both without a profile

The matching rules answer one question — are these two accounts the same person? — and their
contract stays deliberately poor. Reading the result poses a second question the package had no
answer for: the accounts are linked, and the product still has no profile row to show. That is
completeness, not existence, and every product with federated login has it, because a profile table
can always lack a row for someone who already signs in.

`RECONCILIATION_VIEW_STATUS` adds that fourth state in a **separate set**, so callers that only
reconcile never have to learn that profiles exist. `summarizeReconciliation` splits a result list
into the two groups and reports the total; `partitionByExistence` splits the existence group into
its two directions.

Both are generic over the entry type and read nothing but `status`. Products name their local
identifier differently (`userId`, `accountId`, `id`), and demanding one name would force callers to
remap the whole list just to count. Extracting the identifier for a request stays with the caller,
which is the only part the package cannot do without knowing each product's field names.

The bug this prevents is a silent one, and it shipped: a screen took its "1 access exists on one
side only" count from the combined total, so clicking sent two empty sets to the sync endpoint —
the only divergence was a missing profile, which that endpoint does not fix. The API answered
correctly (nothing to create) and the screen did not change, reading as a broken button. Counting
together what is fixed separately always produces that silence.
