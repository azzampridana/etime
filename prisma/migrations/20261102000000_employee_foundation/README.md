# E1 — Employee foundation (source only)

Not executed or validated against a database. Prisma Client generation is pending.

## Storage and compatibility

- Separate lowercase `employee` table; optional unique CHAR(36) userId links a User to at most one Employee. Multiple NULL userId/employeeNumber values are allowed by MySQL/MariaDB unique indexes. No Employee account is required.
- EmploymentStatus ACTIVE/INACTIVE/RESIGNED/TERMINATED is independent of User.role and User.isActive. No trigger, auth change or status synchronization is introduced.
- User deletion retains Employee via SET NULL; existing operational-history deletion blockers remain intact. FK-driven unlinking does not increment Employee.version or update updatedAt. Future Employee writers must account for link changes (lock/re-read the row and validate userId as well as version). Do not infer a historical account association from a detached Employee.
- Nullable DATE joinDate/employmentEndDate are calendar dates, never inferred from account creation. UUID defaults and updatedAt are application-managed; the backfill supplies both explicitly.
- Future CRUD must validate date ordering, normalize optional empty strings to NULL, preserve leading zeros in NIK/account/employeeNumber, and use conditional version increments. These workflows are not exposed in E1.

## Backfill

Copies existing name and normalized position only for active USER accounts without a linked Employee. Initial employmentStatus is ACTIVE for this migration cohort, subject to later ADMIN confirmation; it is not proof of ongoing employment and never changes login eligibility.

No ADMIN/inactive account is automatically linked. Employee number, dates, bank details, NIK, address and phone remain NULL. No fabricated values or matching by name/email. New User accounts created after this migration are not automatically backfilled. Unlinked Employee records cannot safely be matched by name; future linking requires ADMIN review.

The INSERT/SELECT data step is repeat-safe using NOT EXISTS and a unique userId constraint. It does not overwrite profiles. The migration DDL itself is deliberately NOT repeatable: CREATE TABLE must fail on unexpected artifacts rather than hide schema drift. Pause writers; concurrent attempts fail safely through uniqueness, not silent duplicate creation.

## Sensitive data

No Employee service, endpoint, UI, or DTO is exposed in E1. Existing User and Payroll queries use explicit selects; no Employee personal/banking data is added to JWT, User DTO, or Payroll DTO. Future access must enforce active ADMIN authorization and minimal field selects; any future self-service must derive ownership from the session. Never log NIK/account values or include them in audit metadata. No document/image/upload storage is introduced. Fields are not application-encrypted; secure database access and backups as personal data.

## Manual deployment procedure (developer only)

1. Confirm the intended environment without exposing credentials. Review pending migrations, backup/recovery readiness and quiesce writers.
2. Verify existing physical `user` table, CHAR(36) id and utf8mb4_unicode_ci collation, InnoDB/FK compatibility, absence of employee artifacts and failed migrations. DDL autocommits on MySQL/MariaDB; schema and backfill are not a single rollbackable unit.
3. Only after preflight, execute `npx prisma migrate deploy`, then `npx prisma generate`, then `npx prisma migrate status`. Deploy applies ALL pending migrations, not only E1. Do not use reset/db push/migrate dev to replace history.
4. Verify new columns, FK, unique indexes, counts versus the active USER cohort, NULL unknown fields, and preservation of existing operational data. Do not output employee personal data. Verify login/deletion/deactivation and Payroll separately when authorized.
5. On failure stop; inspect partial DDL/history before recovery. Do not blindly rerun, mark resolved, drop the table or restore over live data. Recovery requires an explicit plan and verified backup; remove no personnel data automatically.

**Build risk:** existing npm run build runs Prisma generation AND migrate deploy before Next.js compilation. Adding this migration activates it on that deployment path. Do not run/deploy the build until target and migration are approved.

Payslip snapshots/items, bulk initialization, Publish and PDF remain unchanged; Employee bank integration, Employee UI, documents and Time Off are deferred. No runtime/compilation verification claimed.
