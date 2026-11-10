# Payroll P3A — ADMIN Draft API

Source implementation only; no tests, compilation, application startup, database
queries or Prisma commands were run. Local migration/generation success is operator
reported; the generated source exposes Payslip/PayslipItem. P2 files are preserved.

## HTTP contract

All routes require an active ADMIN session. Services independently enforce ADMIN
access; writes recheck the database actor under a User-row lock inside the transaction.
No USER endpoint, UI, publish operation or PDF generation is included.

| Method | Route | Input |
| --- | --- | --- |
| GET | /api/admin/payroll | Optional year, month, status, userId, page, pageSize |
| GET | /api/admin/payroll/[id] | UUID path parameter |
| POST | /api/admin/payroll | userId, year, month, bankName?, accountNumber?, items |
| PUT | /api/admin/payroll/[id] | version, bankName?, accountNumber?, items |
| DELETE | /api/admin/payroll/[id] | JSON body containing version |

JSON responses use `{ success: true, data }` or `{ success: false, message }`.
POST returns 201; other successful operations return 200. Errors: 400 invalid input,
401 unauthenticated/inactive, 403 non-ADMIN/cross-site mutation, 404 missing resource,
409 duplicate period/stale version/PUBLISHED conflict/transaction write conflict,
500 sanitized unexpected error. All responses are private, no-store and nosniff.

Mutation bodies require application/json. Cross-site Origin or Sec-Fetch-Site is
rejected, with no permissive CORS handler. Same-origin reverse-proxy URL forwarding
must be correct. Cookie/client/secret values and salary/account payloads are not logged.

## Input and monetary contract

- Strict objects reject extra keys, including totals, status, actor and snapshots.
- Year 2000–2100; month 1–12; page >= 1 and <= 1,000,000; pageSize 1–100 (default 20).
  List filters use exact employee UUID. Ordering: year DESC, month DESC, id DESC.
- At most 100 items, each with trimmed nonempty name <= 200 characters, category
  EARNING/DEDUCTION, amount and sortOrder (integer 0–9999). Category/order pairs
  must be unique; names need not be unique. Empty item arrays are permitted for DRAFT.
- Amount accepts a canonical nonnegative integer string up to 18 digits, or a JSON
  safe integer. Use strings to represent amounts beyond Number.MAX_SAFE_INTEGER.
  Fractional, negative, exponent-form strings and extra fields are rejected.
- Calculations use Prisma.Decimal inside the write transaction. Each category sum
  must fit 999999999999999999; deductions cannot exceed earnings. No float conversion.
  Monetary DTO values are decimal strings and timestamps are ISO strings.
- Bank/account are nullable trimmed strings <= 100 characters. Blank or omitted
  values become null. PUT fully replaces editable fields/items, so omitted optional
  bank fields clear them. Account numbers must be strings, preserving leading zeroes.

## Persistence and snapshots

Create locks actor and recipient User rows in sorted unique ID order using the
existing shared User lock helper. Recipient must exist, be active and role USER.
Employee identity is snapshotted from User; company values are server-only constants
for PT Bali Enneaphos from the approved P2 specification. Initial version/template
use schema defaults; status is always DRAFT. Duplicate periods are enforced by the DB
unique constraint, classified specifically by index/fields rather than masking all
unique violations as period conflicts.

Recipient and period are immutable after create. Update cannot refresh employee or
company snapshots, createdAt/createdById or publication metadata. Edit an incorrect
recipient/period by deleting its DRAFT with version check and creating a new DRAFT.

Update/delete lock the actor then the Payslip, check DRAFT and exact version, and
use conditional version/status writes. Update increments version once, replaces all
items atomically and recalculates totals. DELETE uses FK cascade for items inside
the same transaction. A failed operation/audit rolls everything back. All writers,
including future publishing, must use consistent lock order and parent version checks.

AuditLog records created/updated/deleted events atomically with actor, entity ID and
version only; no salary, bank/account or item text is logged. No post-commit cache
revalidation exists in this API-only phase, avoiding false mutation failures from it.
Network response loss remains an ambiguous outcome: reload/list before retrying.

User safe-delete dependency inspection now includes Payslip; existing history
rejection and recipient FK prevent deleting a user who owns any slip. No other User
management or operational-domain behavior is changed.

## Remaining manual verification

Verify anonymous/USER/inactive/demoted ADMIN rejection, owner selection, strict
validation and money boundaries; duplicate-period concurrency; two updates using
the same version; update/delete races; immutable snapshots and PUBLISHED rejection;
transaction rollback/audit atomicity; list filters/pagination and string amounts;
safe-delete dependency; JSON/Origin behavior behind the deployment proxy.
Do not treat source review as runtime verification. Publishing, USER payslips, PDF
and UI remain separate phases. Never edit the database to create sample fixtures
without separate approval.
