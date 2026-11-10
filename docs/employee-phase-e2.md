# E2 — ADMIN Employee Management

Source/diff review only. Generated Client statically contains Employee and EmploymentStatus; database migration status, compilation and runtime were not checked. E1 migration must be applied before using these endpoints. No Prisma or database command was run in E2.

## Boundaries

- /admin/employees uses the existing ADMIN shell/navigation and page authorization.
- GET /api/admin/employees?search=&page= lists 20 rows per page, ordered fullName/id. Search matches name, employee number and linked account email with parameterized LOCATE, following the existing monitoring solution for driver LIKE collation issues. No unbounded history query.
- POST /api/admin/employees creates an unlinked Employee. GET/PUT /api/admin/employees/[id] read/update detail. No DELETE or association mutation route.
- API and services independently require active database-backed ADMIN. Writes recheck the actor after User locking inside the transaction. Update locks Employee, checks version, conditionally updates/increments it and writes audit atomically. Lock ordering is User then Employee. Account deletion may detach userId through FK but this editor never writes/relinks it.
- Strict Zod inputs reject actor/userId/version-on-create and unknown fields. Dates accept real YYYY-MM-DD calendar dates; persistence explicitly uses UTC midnight and DTOs retain date-only strings. End date cannot precede join date. Optional empty strings normalize to NULL. Strings preserve leading zeros. A 5,000-character address input cap bounds form payloads within the existing TEXT column.
- 400 validation, 401 unauthenticated, 403 forbidden, 404 missing, 409 stale/unique/concurrency, sanitized 500. Responses private/no-store. JSON and same-origin checks protect mutations. Conflict and unknown write outcomes block resubmission until explicit reload; committed mutations are not retried if list refresh fails.

## Privacy and UI

List DTO contains no NIK or bank values, only a completeness boolean (bank name/account/holder all present). Sensitive fields are selected only inside server persistence for mapping/detail. ADMIN detail exposes required fields with NIK/account masked by default and an explicit reveal toggle. No browser storage, sensitive URL parameters, payload logging or public files. User relationship/email is read-only; inactive or absent accounts do not prevent personnel editing. Employment status never changes account access.

Compact scrollable ADMIN table and responsive grouped modal reuse existing Button/Input/Textarea and Radix Dialog. Search, pagination, loading, errors, empty states, disabled saving, and unsaved-change confirmation are provided. No automatic account creation or relinking. No Payroll, snapshot, Publish, PDF, Attendance/Overtime/Correction or Time Off changes.

Audit EMPLOYEE_CREATED/EMPLOYEE_UPDATED records actor, Employee ID, timestamp via existing convention, field names and version only; no raw personal values.

## Manual verification

1. Confirm E1 migration readiness separately. Open page/sidebar on mobile/desktop; test search by all three supported keys, pagination, empty/loading/failure states.
2. Verify active ADMIN CRUD; reject unauthenticated/USER/inactive/demoted ADMIN, direct ID calls and cross-site writes. Inspect list responses for absence of NIK/account values.
3. Create unlinked Employee; edit existing linked Employee without changing account identity/status/role. Optional fields can be cleared. Reveal/mask sensitive inputs, preserve leading zeros; leave modal with dirty fields via X/Escape/backdrop.
4. Test real calendar dates/leap days, timezone independence, reversed dates, length limits and unknown payload fields.
5. Two editors saving same version: one wins, the other returns 409 and requires reload. Duplicate non-null employeeNumber gets a clear conflict. Audit must commit atomically and contain field names only.
6. Simulate lost save response/list refresh failure: no automatic retry or false failure after successful save. Creation without employeeNumber has no natural duplicate key; after an uncertain outcome inspect the list before manually creating again.
7. Verify Payroll remains unchanged. Future account linking and Employee-to-Payroll bank integration require separate phases.
