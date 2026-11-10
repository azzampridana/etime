# P3F.1 — Permanent item origin

Source/SQL preparation only. No migration, Client generation, database access,
tests, compilation or runtime verification performed. UI is deliberately unchanged.

## Audit and migration decision

Writers found: manual draft nested create, bulk initialization nested create,
and PUT delete-all/recreate. Draft deletion also cascades items, as before.
Bulk audit records identify the slip operation and component IDs/versions, but
not the created item IDs. Subsequent PUT replaced item IDs, and update audits
contain only parent version. These records cannot reliably establish current
per-item lineage. No historical database data was inspected. No name/category
matching is used to infer provenance.

Migration `20261101180000_payroll_item_origin` adds only payslipitem.origin,
ENUM MASTER/CUSTOM. A temporary CUSTOM default backfills all legacy rows, then
is dropped. Schema has no origin default: every new writer specifies it.
Legacy UUIDs, names, categories, amounts, order and parent data are preserved.
Legacy bulk-created items also become CUSTOM; this intentionally does not claim
unproven lineage and means they may later be edited/deleted as custom items.
No FK to the master table, seed, data deletion or historical reclassification.

DDL may commit between the two ALTER statements. Stop writers, back up, inspect
target/migration state, then apply once. On failure inspect partial column/default
state; do not blindly retry/reset. Existing old writers must not run concurrently
or after deployment: they omit origin and use destructive replacement semantics.

## Writer and contract changes

Manual POST assigns CUSTOM; bulk initialization assigns MASTER explicitly.
POST/PUT reject client origin via strict objects, including origin=CUSTOM.
POST rejects item IDs. PUT accepts optional UUID id for each item:

    { version, bankName, accountNumber, items: [
      { id: "existing UUID", name, category, amount: "0", sortOrder },
      { name, category, amount: "0", sortOrder }
    ] }

Response detail items now include id, origin, name, category, amount string,
sortOrder. Item origin is server-derived and never updated. Foreign/nonexistent
and duplicate IDs are rejected. New entries without IDs are always CUSTOM.
All original MASTER IDs must appear; name/category/order must exactly match
the stored values after normal input normalization. Only amount can change.
CUSTOM entries can be renamed, recategorized, reordered, changed or omitted.
Retained item IDs (MASTER and CUSTOM) remain stable. Omitting a CUSTOM and adding
an ID-less item is treated as deletion plus creation, never identity inference.

PUT still replaces the editable set logically, not through delete-all. Under the
parent lock, retained CUSTOM orders are staged at unique negative positions;
valid input orders remain 0–9999. Then omitted CUSTOM rows are deleted, retained
rows updated, new CUSTOM rows inserted. This permits category/order swaps without
transient unique-index collisions. Temporary positions are transactional and never
committed. Existing data is assumed to follow the previous nonnegative-order rules;
verify externally-written invalid orders before migration/use.

100-item and category/order uniqueness limits, whole-IDR Decimal precision,
nonnegative THP, parent optimistic version update, actor recheck and atomic audit
are retained. PUBLISHED rejects mutations before reconciliation. Existing authorized
whole-DRAFT deletion remains available; MASTER removal through PUT is forbidden.

## Breaking UI dependency / P3F.2

Current P3E form strips IDs from its payload. It will be rejected for slips with
MASTER items. On legacy CUSTOM-only slips, an ID-less replacement still deletes
and recreates custom entries. Do not enable Payroll editing between deploying this
backend and the P3F.2 ID-aware UI. No compatibility fallback by name/order is added.
P3F.2 must retain IDs, omit origin on input, mark MASTER fields read-only (amount
editable), permit CUSTOM editing/removal and create new items without IDs. It must
send every MASTER and preserve its order. Response origin is display metadata only.

## Operator commands (not executed here)

After confirming the intended database, backup/recovery and writer maintenance:

    npx prisma migrate deploy
    npx prisma generate
    npx prisma migrate status

Deploy applies ALL pending migrations: inspect their list first. Do not run build
as a harmless check because this repository's build deploys migrations. Generated
Client must be regenerated for origin types/field selection; source is not currently
verified to compile against the old client. Database DDL rollback needs an explicit
recovery plan; old application writers are incompatible with the new required field.

Manual verification: legacy data preservation; manual CUSTOM and bulk MASTER;
MASTER omit/rename/category/order rejection; spoofed origin/foreign/duplicate IDs;
stable IDs; custom swaps/new/removal; no financial drift; stale concurrent PUT;
PUBLISHED protection and transaction/audit rollback. No Publish/PDF/USER access added.
