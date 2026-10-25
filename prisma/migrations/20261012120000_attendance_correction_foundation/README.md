# Attendance correction foundation — prepared, not executed

Phase 1 provides storage and read compatibility. Phase 2 adds immutable USER
request submission; Phase 3 adds transactional ADMIN decision backend operations.
Phase 4 ADMIN review UI and Phase 5 corrected-attendance overtime exclusions are
implemented. Compilation and runtime behavior remain unverified. Migration
execution, Prisma Client generation, and Phase 6 manual verification and deployment
planning remain pending. Do not expose approval operations in production before
these verification and deployment checks are completed.

## Manual deployment review

- Prisma validation/generation and all database verification were intentionally
  not run. Regenerate the client from this schema in the authorized deployment
  workflow; the current generated client does not include these fields.
- Verify the production MariaDB version, storage engine, foreign-key column
  character sets/collations and nullable composite unique-index behavior.
  The new table follows the existing utf8mb4_unicode_ci migration convention.
- Only lowercase physical tables are referenced. No old migration is edited.
- The pending key is (userId, workDate, pendingSlot). Services MUST use 1
  for every PENDING request and NULL for APPROVED/REJECTED requests, atomically.
  The unique key alone does not enforce the status-to-slot relationship or
  prohibit other slot values. Multiple terminal requests depend on SQL NULL
  unique-key semantics; this has not been verified against production.
- Services must validate type-specific required fields, 30-day Jakarta
  eligibility, positive duration up to 24 hours, mandatory Daily Report, and
  immutable submission-time WorkSchedule snapshots for MISSING_BOTH.
- Request/Attendance references use RESTRICT rather than cascading across their
  reciprocal relations. User deletion dependency checks must account for request
  and review history before request creation is enabled.
- The backfill changes only provenance. Existing check-in sources default to
  NORMAL; only rows with checkOutAt receive NORMAL checkout source. Open checkout
  sources remain NULL. No GPS, timestamps, required minutes or reports change.
- Existing application code must not write checkouts during the interval between
  backfill and deployment of the new NORMAL-source writer. Plan a coordinated
  deployment; this migration is not a rolling-deployment compatibility layer.
- New readers select new columns and require this migration before serving
  requests. The repository's npm build script also invokes migrate deploy;
  simply running it is not a read-only validation step.
- DDL may implicitly commit and may lock/rebuild tables. Review backup, deployment
  window and recovery procedures before applying; do not assume transactional
  rollback of the whole SQL file.

Snapshot schedule ID/name are historical values, not foreign keys to mutable
WorkSchedule data. Nullable report content permits a missing-checkout proposal to
reuse an existing report; approval must enforce a valid report either way.
Approval snapshots and relation/source consistency are enforced in services,
not by these Phase 1 columns alone.

## Unresolved Phase 6 policy planning

The pre-existing current-business-date restriction in
`services/attendance-context.ts` can prevent regular checkout after Jakarta
midnight. It remains unchanged and requires an explicit business decision; this
integration does not introduce cross-midnight regular checkout support. Normal
Overtime retains its existing latest-Attendance/completion/authorization rules
without an additional current-workDate requirement.
