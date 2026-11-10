# Payroll P2 — Database foundation and migration plan

## Status and scope

P2 added source definitions; P2.1 manually prepared migration SQL in
`prisma/migrations/20261101000000_payroll_foundation/migration.sql`.
The SQL has NOT been executed. No Prisma command was run,
and no database was accessed. Prisma Client has not been regenerated. Schema
compilation, target compatibility, migration history and runtime behavior remain
unverified. P2 does not implement Payroll UI, actions, services, repositories or PDF.

Payroll is independent of Attendance, Overtime and both correction workflows.
ADMIN inputs all earnings and deductions manually; no attendance-derived amounts.
Only USER employees are recipients. No Employee ID display/field or Department.

## Schema decisions

- `PayslipStatus`: DRAFT, PUBLISHED; `PayslipItemCategory`: EARNING, DEDUCTION.
  Existing MySQL enums have no separate enum mappings; the same convention applies.
- UUID IDs and references use `String @db.Char(36)`, with Prisma `uuid()` IDs.
- Physical tables are lowercase `payslip` and `payslipitem` via `@@map`.
- User has only a new reciprocal `payslips` relation, not bank or identity columns.
- Employee FK uses `onDelete: Restrict`; item FK uses `onDelete: Cascade`.
  Default Prisma relational `onUpdate: Cascade` applies to these required relations,
  consistent with existing non-correction references. P2.1 SQL explicitly uses it.
- `@@unique([userId, year, month])` applies across both statuses, including DRAFT.
- USER-list index: `(userId, status, year, month)`; ADMIN period/status index:
  `(year, month, status)`. No speculative status-only or actor indexes.
- Item order uniqueness: `(payslipId, category, sortOrder)`. Names may repeat.
  Use category/order plus ID as appropriate for deterministic presentation.
- Earnings, deductions, take-home pay and item amounts use `Decimal(18,0)` for
  whole IDR. Totals default to zero; item amounts require explicit values.
  Values support up to 18 integer digits, but business caps may be lower.
  Decimal storage alone does not reject negative inputs or prevent rounding of
  fractional inputs. Later schemas must reject fractions before persistence.
- Version starts at 1. Timestamps follow existing `DateTime(3)`, `now()` and
  `@updatedAt` conventions. Publication timestamp is initially NULL.
- `templateVersion` defaults to `v1`. No PDF bytes or public paths are stored.

### Field inventory and bounds

Payslip contains `id`, `userId`, `user`, `year`, `month`, `status`,
`employeeNameSnapshot` (100), `employeePositionSnapshot` (nullable, 100),
`companyNameSnapshot` (200), `companyAddressSnapshot` (500),
`companyEmailSnapshot` (nullable, 254), `companyPhoneSnapshot` (nullable, 50),
`bankName` (nullable, 100), `accountNumber` (nullable, 100),
`totalEarnings`, `totalDeductions`, `takeHomePay`, `version`, `createdAt`,
`updatedAt`, `publishedAt`, `createdById`, `updatedById`, `publishedById`,
`templateVersion` (50), and `items`. Parenthesized lengths are VARCHAR limits.
Account numbers are strings so leading zeroes survive.

PayslipItem contains `id`, `payslipId`, `payslip`, `name` (VARCHAR 200),
`category`, `amount`, and `sortOrder`. Period, version and order use Prisma Int;
business bounds are not encoded by that type.

### Actor metadata

`createdById` and `updatedById` are required UUID metadata; `publishedById` is
nullable until publishing. They intentionally are not User FKs. This avoids three
additional User relations and deletion restrictions on administrator accounts,
and retains the historical UUID even if an actor is deleted.

Existing AuditLog uses a nullable actor FK with `onDelete: SetNull`, while generic
entity references survive deletion (`prisma/schema.prisma`, AuditLog).
Payroll metadata complements that pattern; it does not claim the same referential
integrity as an FK. It cannot itself prove that the actor exists or is ADMIN.
P3/P4 must derive actors from the authenticated server identity, recheck active
ADMIN access transactionally, and write AuditLog in the same transaction.
Never accept arbitrary actor UUIDs from the client. Metadata is not authorization.
No actor name/email snapshot is added in P2.

## Snapshot source contract for later services

Employee name and optional position come from the target User at creation,
not client-provided employee identity. Company data comes from server configuration:

- Company: PT Bali Enneaphos
- Address: Jl. Raya Gerih No.99, Sibang Kaja, Kec. Abiansemal, Kabupaten Badung, Bali 80352
- Email: hello@balienneaphos.com
- Phone: +6282341442786

These values are documentation only: no defaults, seed or environment changes.
Bank/account information belongs to the individual slip. PDF must later render
persisted snapshots, never silently replace them with live User/company data.
Published snapshots and items must remain immutable.

## Mandatory P3/P4 integrity and security work

- Require active ADMIN for writes and recheck inside the transaction. Recipient
  must be role USER; enforce active-recipient policy at creation/publication.
- Validate month 1–12, reasonable year bounds, positive version, bounded nonnegative
  sort order, nonempty trimmed names, field lengths, and a bounded item count.
- Validate whole-rupiah nonnegative amounts. Use Decimal arithmetic and string
  transport; never JavaScript floating-point conversions for monetary values.
- Recalculate totals from items on the server; never trust client totals.
  Earnings/deductions must be nonnegative and take-home pay must equal earnings
  minus deductions and be nonnegative. Check sum overflow before storing.
- Catch duplicate-period unique violations safely, including concurrent creates.
- Use version/status conditional updates for editing, deleting and publishing.
  Every item mutation must lock/check its parent; totals and items change atomically.
- Reject edits/deletion of PUBLISHED parents AND their items. Cascade does not
  enforce status; direct database writes are not protected by service rules.
- Publish atomically with consistent publishedAt/publishedById, totals, version
  and AuditLog. Define idempotent retry behavior: already-published results must
  not rewrite snapshots, timestamps, version or duplicate publication audits.
- Keep committed success separate from post-commit revalidation failures.
- USER list/detail/PDF must enforce active identity, ownership and PUBLISHED status.
  Do not log salary/account payloads. No shared/public cache or public PDF storage.
- No silent unpublish or revision workflow. Any future revision design needs
  separate approval and must preserve one slip per employee/period.

These are future requirements, not protections implemented by P2. No CHECK
constraints or triggers have been introduced. An FK cannot enforce recipient role.

## User safe-delete integration deferred to P3

`repositories/user.repository.ts::findUserDeletionDependencies` currently checks
Attendance, authorization and correction dependencies, not Payroll.
`services/user.service.ts::deleteUser` turns those into a friendly history error.
Do not change these files in P2. Before enabling Payroll writes, P3 must add a
Payslip dependency check with the existing transaction/user-lock pattern, while
keeping the recipient FK as the final protection against races. After migration,
the FK blocks deletion of any recipient with a slip (including a DRAFT), but the
existing service alone may return a generic error until that integration is done.
Actor metadata alone is intentionally not a deletion blocker.

## Migration plan — separate explicit approval required

Existing folders use a timestamp plus descriptive snake-case suffix, e.g.
`20261014120000_overtime_correction_foundation`. They contain migration.sql and
may contain a README. Existing SQL uses lowercase recent table names, CHAR(36),
ENUM, DATETIME(3), named constraints and utf8mb4/utf8mb4_unicode_ci.
These observations do not establish the current target database state.

For a separately authorized migration phase:

1. Confirm exact target, engine/version, migration history/checksums, current User
   PK type/collation, schema drift and absence of partial Payroll tables/artifacts.
2. Establish writer maintenance; create and verify a complete recoverable backup.
   Obtain explicit production approval if applicable.
3. Review the manually prepared `20261101000000_payroll_foundation` migration
   against the schema and target. Do not create a duplicate migration, rewrite
   existing migrations or infer/apply unrelated casing drift.
4. Expected scope: create `payslip`, create `payslipitem`, their primary/unique/list
   indexes and two FKs. Referenced tables must exist before FK creation. No existing
   operational row updates, backfills, drops or User scalar-column changes expected.
5. Review actual SQL for matching column lengths/defaults/nullability, inline ENUMs,
   DECIMAL(18,0), DATETIME(3), FK delete/update behavior, charset/collation and names.
   Prisma uuid()/@updatedAt behavior must not be mistaken for SQL-generated defaults.
6. Apply only after review/backup/approval. MySQL/MariaDB DDL can commit partially;
   on failure stop and inspect migration history/artifacts, never blindly retry,
   reset or repair history. No automatic restore over current data.
7. Verify new empty tables, constraints, indexes, migration status and preservation
   of existing record baselines; generate Prisma Client only when authorized.
   Do not enable Payroll writers before foundation/client/safe-delete integration.

`package.json` build runs generation, migration deployment, then Next.js build.
Therefore a build is not a harmless validation step; schema migration can persist
even if TypeScript/build later fails. No build or Prisma command was run in P2.
P2.1 now provides unapplied migration SQL; generated Client is still unchanged.
Including this pending migration in a deployment makes the build capable of
applying it automatically. Do not run a build or deploy this migration to production
before separate approval and preflight, even just to check compilation.

Recovery must be planned per environment. Rolling back application code does not
undo DDL. Prefer additive compatibility; dropping Payroll tables after real slips
exist would destroy financial history. Any restore/destructive recovery requires
separate approval and a plan for writes made after the backup.

## Review decisions before migration

Confirm actor metadata without FKs and VARCHAR bounds; target engine/collation and
approved deployment/backup procedure. Establish reasonable year/amount/item-count
limits, active-recipient policy and published retry behavior before P3/P4.
PDF implementation, artifact retention and future revision policy remain deferred.
No outstanding decision authorizes extra statuses, Employee ID or Department fields.

## P2.1 static SQL review

- Provider: `mysql` in schema and migration_lock.toml. prisma.config.ts loads local
  environment through @next/env and reads DATABASE_URL; no environment values or
  database target were inspected/confirmed in P2.1.
- Payslip has 24 physical columns; relation properties `user` and `items` are not
  columns. PayslipItem has 6 physical columns; `payslip` is a relation property.
- All schema scalar columns, VARCHAR/CHAR lengths, nullability, inline ENUM order,
  DECIMAL(18,0) precision and defaults are represented in SQL. IDs have no SQL UUID
  default; updatedAt has no automatic SQL timestamp default/update clause, matching
  existing Prisma-managed behavior. createdAt uses CURRENT_TIMESTAMP(3).
- Two primary keys, two unique indexes, two nonunique list indexes, and two named
  foreign keys are provided. Names match Prisma's conventional physical-table-based
  names, remain below MySQL identifier limits and do not occur in older migrations.
  Unique/index prefixes already index FK columns; no extra FK indexes are needed.
- Actor IDs remain metadata without FKs. No CHECK, trigger, seed, data backfill,
  INSERT/UPDATE/DELETE, DROP or ALTER of operational tables is included.
- The only ALTER statements add FKs to the two newly created Payroll tables.
  Referenced `user` must already exist; both new tables exist before adding FKs.
- Existing migrations specify utf8mb4/utf8mb4_unicode_ci, which the new tables use.
  The actual `user.id` charset/collation, CHAR(36) type, table engine, and referenced
  primary key must be confirmed before execution. Existing SQL does not explicitly
  select an engine; this migration follows that convention. Confirm InnoDB/default
  engine and FK support rather than assuming every server has the same defaults.
- The initial migration creates PascalCase `User`, while current schema maps it to
  lowercase `user` and recent migrations reference lowercase. Case-sensitive fresh
  replay on Linux may therefore fail unless the environment/history is reconciled
  separately. Do not rename existing tables or repair old migrations in this phase.
- ENUM, DECIMAL(18,0), DATETIME(3) and these referential actions match the source
  provider conventions for modern MySQL/MariaDB. No existing DECIMAL migration was
  found to reuse; its SQL type follows the explicit @db.Decimal(18,0) schema.
  Actual engine/version, SQL mode, privileges and compatibility remain unverified.

### Local activation and failure gates (not executed)

After separate authorization, resolve the target from the actual Prisma configuration
and any environment overrides without printing credentials. Confirm the intended
local host/port/database and server engine/version; stop for any remote target.
Inspect applied/failed migration records and checksums, actual table definitions,
FK/index names, and absence of payslip/payslipitem or other partial artifacts.
Verify that this is the only intended pending migration before deploy, since deploy
applies pending migrations rather than selecting only one by filename.

Quiesce writers, capture operational table counts/integrity baselines, and create a
fresh complete backup including _prisma_migrations. Record its path, successful exit,
nonempty size and checksum; verify schema/data coverage and an available recovery
procedure. Do not perform a restore rehearsal or production access without approval.

SQL consists of multiple DDL statements, not an all-or-nothing migration transaction.
Even where individual DDL is atomic, earlier CREATE TABLE/FK operations can persist
after a later failure. Do not add IF NOT EXISTS to hide partial state.
On failure stop: inspect migration status/history, completion/rollback markers and
the exact new tables, columns, indexes and FKs using separately authorized read-only
inspection. Preserve logs without secrets. Classify what actually committed before
proposing recovery. Do not blindly rerun, drop tables, reset, mark a migration resolved
or restore over existing data. Any repair must be reviewed against preserved data and
approved separately. A failed app build after successful migration is not a failed
database migration and is not a reason to rerun SQL manually.

Ready for human review and a separately authorized local preflight, not an execution
GO. Production execution requires separate explicit approval. No runtime/Prisma
validation, migration, database connection, build or tests were performed in P2.1.
