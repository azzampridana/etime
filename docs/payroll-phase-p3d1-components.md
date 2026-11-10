# Payroll P3D.1 — Master components foundation

Source and SQL preparation only. No migration, generation, database access,
compilation or runtime verification performed. The installed generated Client does
not yet include this new model. Migration and Client generation must be separately
authorized before these endpoints can be used or the new source compiled.

## Storage and uniqueness

`PayrollComponent` maps to lowercase `payrollcomponent`. UUID CHAR(36), name
VARCHAR(200), existing PayslipItemCategory enum, sortOrder INTEGER, isActive
BOOLEAN default true, version INTEGER default 1, DATETIME(3) createdAt/updatedAt.
UUID and updatedAt are Prisma-managed; createdAt has a database default.
No amount, employee association, mandatory flag or relation to historical items.
Every active row is mandatory for future initialization only.

Unique `(category, name)` applies to both active and inactive rows. Reuse/reactivate
an inactive component instead of creating a duplicate. This intentionally stronger
rule avoids competing inactive copies and reactivation collisions, while placing
no constraint on historical PayslipItem snapshots. The database's explicit
utf8mb4_unicode_ci collation makes names case/accent insensitive. Input trims and
collapses whitespace. No preflight duplicate lookup is relied on: the unique index
also protects simultaneous writes by different ADMINs. Sort order is not unique;
ties are deterministically ordered by ID.

Migration `20261101120000_payroll_components_foundation/migration.sql` only creates
the new table and its indexes. No FK, ALTER of existing tables, seed, backfill or
data mutation is included. P2 migration remains unchanged. MySQL/MariaDB syntax
follows P2; actual target version/collation/index compatibility remains unverified.

## API contract

All endpoints require active ADMIN independently at API and service boundaries.
Mutations lock/re-read the actor inside the transaction, then lock the component
for updates. Conditional version writes, version increment and AuditLog are atomic.
No hard-delete endpoint. A deactivate call with the current version sets false
and increments version even if already inactive; stale retries return 409.

- GET `/api/admin/payroll-components`: optional category, isActive (`true`/`false`),
  page (default 1, max 1000000), pageSize (default 20, max 100).
  Returns `{items,total,page,pageSize}` under the existing success/data envelope.
  Default includes active and inactive rows; order category, sortOrder, ID ascending.
- POST `/api/admin/payroll-components`: `{name,category,sortOrder,isActive?}`.
  isActive defaults true; response 201 with component DTO.
- PUT `/api/admin/payroll-components/[id]`:
  `{name,category,sortOrder,isActive,version}`; all fields required.
  Reactivation uses this endpoint. Returns the updated DTO/version.
- POST `/api/admin/payroll-components/[id]/deactivate`: `{version}`.
  Returns the updated DTO/version.

Strict objects; name 1–200 characters, category EARNING/DEDUCTION, integer sortOrder
0–9999, version 1–2147483646. IDs are UUIDs. DTO timestamps are ISO strings.
No actor ID is accepted. Shared P3A API helper preserves private/no-store,
same-origin JSON mutation rules, sanitized errors and status codes
400/401/403/404/409/500. Duplicate index conflicts become 409; unknown persistence
errors are not mislabeled. P2034 uses the existing 409 mapping. No automatic retry.
Clients must reload after conflicts or uncertain network outcomes.

## Compatibility and future initialization

P3A API, draft rules and P3B UI are unchanged. Existing draft creation is not forced
to include master rows in this phase. No financial calculations were added; current
precise IDR calculations and PUBLISHED restrictions remain unchanged.

A later, separately authorized initializer should read active master rows in a
consistent transaction and copy name/category/order into independent PayslipItems
with amount `"0"`. Never copy amounts from the previous period. Resolve tied master
sort orders deterministically into unique category/order positions required by
PayslipItem. Preflight the existing 100-item draft limit; do not silently truncate
master rows. Define initialization concurrency/idempotency and snapshot timing
before implementation. Extra employee-specific components remain ordinary items,
not master additions. Master rename/category/deactivation cannot rewrite slips.

## Pending verification and deployment

Separately review target and migration history/backup before migration execution;
generate Prisma Client afterward. The existing build script can deploy pending
migrations, so do not run it as a harmless validation step. No production approval
is implied. Verify authorization, collation-based duplicates/reactivation, stale
versions, concurrent create/update/deactivate, rollback/audit atomicity and legacy
draft behavior in an authorized later phase. No UI, bulk initialization, Publish,
PDF or USER access is implemented here.
