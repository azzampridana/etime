# Payroll P3D.2 — Bulk draft initialization

## Readiness and verification boundary

Operator reports local localhost:3306/etime: 12 migrations, master-component
migration successfully applied, Prisma Client 7.8.0 generated, migration status
up to date. Static inspection confirms generated PayrollComponent model/export.
No database, Prisma CLI, automated validation, application or production access
was performed in this phase. Prior P3D.1 notes describe its earlier preparation state.

## Contract

POST `/api/admin/payroll/initialize`, same-origin application/json:
`{"year":2026,"month":11}`. Strict existing year/month rules; extra fields rejected.
Active ADMIN required by the shared API boundary and service. No UI added.

Existing private/no-store envelope `{success:true,data:summary}` is retained.
HTTP 200 means a report is available, NOT necessarily that all drafts were created.
Consumers MUST inspect `data.status` (`completed` or `stopped`) and
`remainingEmployeesProcessed`. A stopped report explicitly represents partial
progress. Preflight/auth errors use existing 400/401/403/409/500 conventions.

Summary includes operationId, period, componentCount, eligibleEmployeeCount,
createdCount, skippedExistingCount, skippedIneligibleCount, failedCount,
unconfirmedCount, message and per-employee outcomes (userId + outcome only).
No names, salary values, bank details or raw error data are returned. Employee IDs
allow reconciliation of partial results by ADMIN and are not employee-facing labels.
eligibleEmployeeCount counts employees actually confirmed eligible under lock,
including a failed/unconfirmed attempt when eligibility was reached; it is NOT a
total of unprocessed employees after interruption. failedCount only counts known
P2034 rollbacks; other uncertain failures are conservatively unconfirmed, not
claimed to be rolled back. Unprocessed rows are not counted as failures.

## Snapshot, batches and transactions

Read up to 101 active components in one SQL statement. Zero or more than 100 aborts
before any draft/audit write. Master snapshot is frozen for the operation, ordered
by category/sortOrder/id; per-category sequential order removes ties. Copy only
name/category/order to independent items at exact Decimal zero. No live master FK
or previous-period amounts. Remaining extra-item capacity is 100 minus master count.
At 100 components no additional employee-specific item fits the existing API limit.

Employee reads use keyset batches of 50, ascending ID with an initial upper-ID
bound. Select active USER only; no ADMIN selection. This is a bounded traversal,
not a global employee snapshot: changes/new activations behind the cursor or beyond
the upper bound wait for another invocation. Newly eligible rows ahead of the cursor
may be included. Rerun after employee changes to catch omissions safely.

One transaction per employee bounds locks and duration. Lock actor + recipient in
sorted User-ID order (same helper as manual create), re-read actor activity/ADMIN,
re-read recipient role/activity, then check unique employee/period existence.
Eligibility changes before locking cause a safe skip; changes after locking wait.
Snapshot current name/position and the exact P3A company constants. Bank/account
are null; DRAFT, zero totals and existing version/template defaults apply.
Nested item creation and per-slip audit commit atomically. No period-wide rollback:
earlier successful employees remain committed if a later employee fails.

Different ADMINs serialize at each shared recipient lock. Unique employee/year/month
is the final protection, including concurrent manual create. A specifically matched
unique race becomes skippedExisting, never an upsert/update. Other errors stop the
operation, not silent continuation. Unknown commit outcomes require authoritative
reload. No automatic retries. Lost HTTP response or authorization loss can prevent
delivery of the partial report; inspect Payroll and repeat initialization safely.

Every existing slip, regardless of status, is untouched: no changes to items,
totals, snapshots, status or version. Repeated calls only fill missing slips.
Concurrent deliberate draft deletion can make a later invocation recreate it;
initialization does not prohibit existing authorized delete behavior.

## Audit and operational limits

PAYROLL_INITIALIZATION_STARTED records actor/operation/period/component count,
including zero-recipient and all-skipped runs. It means started, not completed.
Each actual creation records existing PAYROLL_DRAFT_CREATED with operation ID,
source, period/version and master IDs/versions in the same transaction as its slip.
No salary or bank details. Skips do not mutate slips or their audit history.

Work is synchronous and total request duration grows with employee count; server
timeout/process termination can leave committed partial progress. The response
outcome array also grows with processed employees, though database reads and locks
are bounded. A durable background job is outside scope. Validate deployment capacity
before large runs. Master changes during execution affect subsequent invocations
only; a retry after master edits may initialize remaining employees with the newer
snapshot. Already-created slips intentionally never receive retroactive master edits.

## Manual checks before UI integration

Verify zero/101 master rejection with no draft creation, tied master order, inactive
components, 100-item capacity, active USER selection and eligibility changes,
independent snapshots, zero totals, unchanged DRAFT/PUBLISHED, repeated calls,
simultaneous ADMIN/manual creation, audit rollback, mid-run database failure,
unknown commit/network outcomes, actor deactivation/demotion, pagination traversal
and private/no-store responses. Compile/runtime behavior remains unverified.
P3E must distinguish stopped from completed reports and reconcile before retries.
No P3E, Publish or PDF implementation is included.
