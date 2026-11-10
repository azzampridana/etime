# E3 — Employee profile and family contacts

Source-only implementation. Migration, Prisma generation, compilation and runtime checks have NOT been run. The installed generated Client must be regenerated before this source can compile against the new fields/model.

## Additive storage

Exactly eight nullable Employee scalar columns: npwp VARCHAR(32), placeOfBirth VARCHAR(100), dateOfBirth DATE, gender ENUM, maritalStatus ENUM, bpjsKesehatanNumber VARCHAR(50), bpjsKetenagakerjaanNumber VARCHAR(50), employmentType ENUM. Existing rows retain NULL for new values; existing columns and backfills are unchanged.

No equivalent enums existed. Chosen nullable categories:
- Gender: MALE, FEMALE, OTHER.
- MaritalStatus: SINGLE, MARRIED, DIVORCED, WIDOWED.
- EmploymentType: PERMANENT, CONTRACT, PROBATION, INTERN, FREELANCE.

Confirm these labels with the personnel owner before deployment. No category is inferred from legacy data.

employee_family_contact has CHAR(36) UUID IDs, Employee FK ON DELETE RESTRICT / ON UPDATE CASCADE, employeeId index, required name/relationship/phone strings, optional TEXT address, emergency/primary flags, DATETIME(3) timestamps, version default 1. UUID and updatedAt remain Prisma-managed.

## Server rules and concurrency

All contact writers lock acting User then Employee. Active ADMIN is rechecked inside the transaction. Parent employeeVersion is mandatory for create/update/delete; update/delete also require contact version and verify contact belongs to the route Employee. Parent version increments with every contact mutation. Selecting a new primary demotes old primary rows and increments their versions atomically. Emergency=false forces Primary=false. Deleting primary does not elect a replacement.

At most one primary is enforced through the shared parent lock/service, not a database unique boolean constraint (which would incorrectly limit nonprimary contacts). Any future writer/import must use this protocol. Direct out-of-band SQL can violate these invariants. Mutations and metadata-only audit commit/rollback together. Profile edits conflict with contact changes instead of silently overwriting concurrent work.

## API and privacy

Existing profile create/update/detail accept the new fields. No new data added to list DTO, JWT or User DTO. Dates use YYYY-MM-DD input/DTO and UTC midnight persistence; identifiers stay strings.

GET/POST /api/admin/employees/[id]/contacts; PUT/DELETE /api/admin/employees/[id]/contacts/[contactId]. GET has page pagination (20 rows), stable primary/createdAt/id ordering. API/service independently enforce ADMIN; existing JSON/same-origin, private/no-store and sanitized error handling apply. Audit contains actor/entity IDs, field names, parent version and demotion count, never personal values.

## UI

Existing ADMIN Employees editor has Personal Information, Employment Information, Contact Information, Bank & Social Security, Family & Emergency tabs. New Employee save remains in the editor with server ID; later saves are PUT, avoiding repeated POST after a confirmed save. Contacts are unavailable until Employee is saved. No automatic retries after unknown outcomes. Check authoritative lists before retrying an uncertain creation.

NIK/NPWP/BPJS/account use masking/reveal. Contact list masks phone; contact editor provides reveal. No local/session storage. Profile and contact state are separate; tab switching retains profile edits and confirms discarding contact edits. X/Escape/backdrop and browser unload guard unsaved/pending work. Contact changes require profile edits saved first. Profile versions are not silently refreshed from a newer contacts list; conflicts require profile reload.

## Manual deployment (not executed)

1. Confirm intended environment, backup/recovery readiness, E1 migration present, and no failed/partial E3 artifacts. Check Employee FK type/collation compatibility and quiesce writers.
2. Run `npx prisma migrate deploy`, then `npx prisma generate`, then `npx prisma migrate status` after approval. Deploy applies ALL pending migrations. Existing build script also deploys migrations, so review deployment sequencing before any build.
3. MySQL/MariaDB DDL autocommits: on failure stop and inspect partial artifacts/history; do not blindly retry/reset/drop/resolve. Do not edit applied migration files.

## Manual acceptance

- Verify legacy Employee data preserved, all eight additions nullable, new table empty, expected FK/index and regenerated Client.
- Create/update all tabs, clear nullable fields, preserve leading zeros, test leap dates/timezone independence and masked/revealed values.
- Save a new Employee then add multiple family/non-emergency/emergency contacts. Confirm no duplicate Employee on later Save.
- Select primary A then B: only B primary and A version increments. Turning Emergency off clears primary; deleting primary leaves no replacement.
- Two ADMIN sessions edit same/different contacts or profile concurrently: stale parent/contact versions yield 409, no partial mutation/audit. Cross-Employee contact IDs return 404.
- Simulate failed/lost responses and list reload failures; verify no automatic retry and no false failed commit. Reload must be explicit; unsaved edits require confirmation.
- Verify ADMIN-only access/no-store, no sensitive values in audits, no contacts exposed to USER endpoints. Check pagination, five-tab keyboard navigation, small-screen wrapping and all close paths.
- Recheck Payroll and operational modules manually: their source, bank integration, Publish/PDF and domain behavior were not changed in E3.
