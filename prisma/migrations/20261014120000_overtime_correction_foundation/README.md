# Overtime correction foundation — not executed

C2 adds storage/read compatibility only. No request submission or approval exists.
Prisma generation, validation, compilation and runtime verification were not run.

## Later local procedure (requires separate authorization)

1. Confirm the resolved environment is the intended local database without logging credentials.
2. Inspect migration status, checksums and actual columns, indexes, foreign keys,
   triggers and updatedAt behavior. Stop for drift, failed or partially applied migration.
3. Back up schema/data including migration history; verify backup and recovery readiness.
   Record row counts and fingerprints of all old Overtime columns.
4. Verify InnoDB, FK CHAR(36) types/collations, ENUM, JSON, DATETIME(3), and nullable
   unique-key behavior on the actual target. Local MySQL 9.7.1 success would not
   establish production MariaDB compatibility; inspect its exact version separately.
5. Quiesce old writers. Run `prisma migrate deploy` through the installed project CLI.
   Do not use db push/reset, or the build script (which also deploys migrations).
6. Verify status, table, four foreign keys, indexes, nullable GPS/photo fields,
   completed NORMAL backfill and open NULL source. Compare old-column fingerprints.
7. Run `prisma generate`, then authorized application validation before enabling readers.
   New readers and deletion dependency queries require this migration and new client.

## Safety and deferred invariants

DDL can implicitly commit and lock/rebuild tables. Do not blindly retry partial
failures or assume application rollback reverses DDL. Preserve backup and evidence;
review recovery before making migration-history changes. No existing migration is edited.
The backfill updates only source; verify there are no custom timestamp triggers.
Old Checkout writers must not run between backfill and deployment of the NORMAL writer.

Future snapshots must be versioned JSON validated by the service. createdAt is the
submission timestamp. There is no redundant type/workDate/deadline snapshot column.
Writers must explicitly maintain PENDING/slot 1 and terminal/slot NULL atomically.
Unique slots allow rejected history but alone do not enforce status consistency,
immutable terminal requests, proposal limits, snapshot integrity or applied-reference
target/status consistency. C3/C4 must enforce these with locks and conditional writes.
Strict stored maxOpenMinutes and inclusive deadline-date-WIB + 30 calendar days
remain future service rules. Revocation after start does not automatically invalidate
correction. No evidence may be fabricated; unresolved overlaps block approval.

Production requires its own preflight, verified backup/recovery and explicit approval.
No production deployment is authorized by this source-only change.
