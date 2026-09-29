# ETime

Workforce Attendance & Activity for Enneaphos Group.

## Development

Use Node.js 24 LTS and npm. Install locked dependencies with `npm ci`.
For a new checkout, create `.env` from `.env.example` and supply local credentials.
Keep an existing `.env` intact; never commit it.

```sh
npm run db:generate
npm run dev
```

The root route redirects to `/login`, `/home`, or `/admin` using current database
identity. Home and admin use the Phase 4 worker and administration shells.

## Validation

```sh
npm run lint
npm run typecheck
npm test
npm run db:validate
npm run db:generate
npm run build
```

## Database setup

MariaDB uses the Prisma `mysql` provider. `prisma.config.ts` loads the existing
Next.js environment files. Runtime initialization in `lib/db/prisma.ts` is lazy,
server-only, and cached on `globalThis` to avoid extra pools during hot reload.
It uses `PrismaMariaDb` with the connection URL, preserves URL options, and sets
UTC date handling. Repositories share this client; services never instantiate it.
Generated Prisma code is ignored and must be regenerated after schema changes.

```sh
npm run db:migrate:deploy
npm run db:seed
npm run db:verify
```

Builds do not run migrations or seeds. The first migration is
`20260917160000_init_user_domain`. Local `migrate dev` was denied permission to
create its shadow database (P3014/P1010). After confirming the database had zero
tables, this migration was generated with `prisma migrate diff --from-empty
--to-schema prisma/schema.prisma --script` and applied with `prisma migrate deploy`.
No resets, permission changes, or manual business-table creation were used.
Future `npm run db:migrate:dev -- --name <name>` needs a permitted shadow database.

## User domain

Follow `AGENTS.md`: Server Action -> Zod -> service -> repository -> Prisma.

- `prisma/schema.prisma`: UUID identifiers; ADMIN/USER enum; User, WorkSchedule,
  and AuditLog models. Email and schedule names have database uniqueness.
- `schemas/user.schema.ts`: normalized email, trimmed name, UUIDs, strict input
  objects, bounded pagination, and explicit password update behavior.
- `services/user.service.ts`: create/update/status/read/list operations.
- `repositories/`: safe user selection, schedule lookup, audit writes.
- `lib/db/transaction.ts`: transactions for user mutations with audit records.
- `mappers/user.mapper.ts`, `types/user.ts`: explicit safe DTOs with ISO timestamps;
  no password hashes or final localized presentation strings.
- `actions/users/index.ts`: thin validated actions using the shared ActionResult.

User updates take the complete editable profile (name, email, role, schedule).
Omitted or empty new passwords preserve the stored hash. Status changes use their
own action. All assignments require an active existing schedule. Email uniqueness
is checked in the service and database unique-constraint races are translated.
List requests default to 20 and are capped at 100 rows.

### Authentication and authorization (Phase 3)

`auth.ts` configures next-auth 5.0.0-beta.32 with Credentials and an eight-hour JWT
session. The installed version supports the existing NEXTAUTH_SECRET and
NEXTAUTH_URL variables. Use a strong random secret and the canonical HTTPS URL
in deployment; the configured URL supplies Auth.js's trusted origin. No Auth.js
database adapter, extra authentication models, or Phase 3 migration is needed.

Login flows from `components/auth/login-form.tsx` through `actions/auth/index.ts`,
Auth.js, `services/auth.service.ts`, the user repository, and the existing bcrypt
utility. The public response is identical for unknown email, wrong password,
and inactive user. Unknown emails still perform bcrypt comparison against a
dummy hash. Unexpected failures use a generic message; auth logs omit error
objects, credentials, cookies, tokens, and database details.

The session exposes only `user.id`, `user.name`, `user.email`, and `user.role`,
plus Auth.js's expiry. These JWT-backed fields are identity snapshots, not an
authorization source. Client-requested session updates cannot change them.
`lib/auth/current-user.ts` is the canonical session-reading helper. It passes
only the session user ID to an uncached database lookup for current active status
and role. Missing, deleted, or inactive users resolve to no current user.

`requireUser()` and `requireAdmin()` in `lib/authorization/require-user.ts` enforce
that authoritative identity. Page boundaries translate unauthenticated errors to
`/login` and forbidden admin access to `/home`; actions return safe ActionResult
errors. No middleware-only protection or client role check is relied upon.

Every User Server Action, including reads, calls
`lib/authorization/user-action-boundary.ts` before parsing input or calling the
service. It requires the current active ADMIN and derives `actorId` from that
identity. Browser-supplied actor fields are rejected by strict schemas. Services
remain trusted internal APIs and do not establish caller identity. No User CRUD
UI exists yet; future routes/actions must use these same authorization helpers.

Deactivation or demotion takes effect at the next protected boundary, even with
an unexpired JWT. No blacklist or session table is introduced. Self-deactivation
and self-demotion remain allowed because no last-admin/self-change policy has
been specified; subsequent requests immediately lose access. Bootstrap actors
remain nullable. Path revalidation belongs with future admin management pages.

`/login` redirects already-active users according to their current database role.
Both roles can access `/home`; only ADMIN can access `/admin`. Sign-in returns
through `/` for authoritative role routing. Logout uses Auth.js and returns to
`/login`. No public registration, password reset, or extra providers are present.

After building, run `npm run start` in one terminal and
`npm run test:auth:integration` in another for opt-in HTTP integration checks.
They exercise the rendered forms and Server Actions, seeded ADMIN login/logout,
temporary ADMIN/USER/inactive accounts, safe session fields, generic failures,
redirects, and existing-session behavior after demotion/deactivation. The script
only accepts a local NEXTAUTH_URL, leaves the seeded admin unchanged, and removes
its temporary users/audits in a finally block. `npm test` runs isolated service,
policy, schema, password, and DTO tests without database mutations.

### Passwords

`lib/auth/password.ts` centralizes bcrypt with cost 12 and verification. Creation
requires at least eight characters and at most 72 UTF-8 bytes to avoid bcrypt
truncation. Password whitespace is preserved. Plaintext inputs and password hashes
are excluded from DTOs, audit metadata, and error logs.

### Schedule and time

Schedule start/end values are `CHAR(5)` clock strings (`HH:mm`), not timestamps.
The default schedule is 08:00-16:00 with an independent, authoritative
`requiredWorkMinutes` of 480. No breaks or timezone rules are inferred from it.
Timestamps are absolute/UTC-based; future event timezones remain independent IANA
identifiers. `Asia/Jakarta` remains an administrative presentation reference.

### Seed and audit

The seed validates SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD, and SEED_ADMIN_NAME.
It creates the default schedule and a bcrypt-hashed active ADMIN atomically with
a USER_CREATED audit. Repeated runs do not update names, passwords, schedules,
status, timestamps, or audit history. Conflicting existing bootstrap records
(e.g. a non-admin with the seed email) fail without silently elevating privileges.
Schedule identity uses its unique name; do not rename the bootstrap schedule
without updating the seed convention.

Audit actor IDs are nullable for trusted bootstrap/system operations. User-domain
mutations accept an internal context and write audits in the same transaction.
Metadata is deliberately allowlisted and contains no credentials or hashes.
`prisma/verify.ts` performs read-only checks and prints booleans only. Password
verification against seed credentials is an initial-bootstrap check; it will fail
as expected after an administrator changes that password.

Seed, verification, and test scripts use Node's `react-server` condition so the
`server-only` import guard also works in trusted CLI processes; client imports
remain prohibited in Next.js.

## Application shells (Phase 4)

`app/(user)/layout.tsx` provides a compact branded header, the existing logout
control, and fixed Home/Attendance/Overtime navigation with safe-area padding.
Home reads the existing User service and safe DTO after authenticating the
session-derived identity. It displays current employee and schedule data;
`formatDurationMinutes` formats `requiredWorkMinutes` without calculating it
from the schedule clock times. Phase 5 replaces Attendance with regular check-in;
Overtime remains a placeholder.

`app/(admin)/admin/layout.tsx` provides a persistent sidebar from 768px upward,
an identity/logout header, and a native disclosure menu on smaller screens.
Dashboard contains navigation links, not operational metrics. Users, Attendance,
Overtime, and Reports destinations are intentional placeholders.

Layouts and pages remain Server Components. Only active navigation highlighting,
the small-screen admin menu, and existing form interactions use client code.
Shared navigation lives in `lib/navigation.ts`; links use `aria-current`, labels,
icons, and visible focus states. Both shells provide a skip-to-content link.

The existing `requirePageUser` helper uses React's request-local `cache` to share
layout/page authorization work within one render. Each page still calls it so
authorization runs when navigation reuses a layout. This is not cross-request
caching: new protected requests recheck current database active/role state.
Sensitive Server Actions retain their independent ADMIN guards. Future protected
pages must keep a page-level check; layout protection alone is insufficient.

No Phase 4 dependencies or Prisma migration were needed. Future features should
replace their placeholder content inside these layouts, using the existing
authorization and service/repository boundaries.

Phase 4 browser verification used headless Edge at worker widths 320, 375, 390,
and 430px, admin widths 768, 1024, and 1440px, plus the admin disclosure at 375px.
Checks covered overflow, navigation clearance, active links, touch targets,
keyboard skip links, logout, and deactivation during client-side navigation.
A temporary schedule with 450 required minutes and 08:00-16:00 clock times
confirmed Home displays `7h 30m` independently of the clock-time span. Test users,
audit entries, and the schedule were removed. The retained HTTP integration test
also covers every placeholder route's active-user/ADMIN protection.

## Foundation and remaining scope

The canonical `cn()` is in `lib/utils.ts`; foundational shadcn components are in
`components/ui/`. Unused domain folders remain reserved locally without fake code.
There is no `src/` tree. Storage variables remain reserved for later phases.
Seed/database scripts do not import the authentication runtime or require auth
environment variables.

The dependency audit still reports nine advisories (four moderate, five high) in
Prisma tooling and its transitive dependencies, including the adapter's nested
MariaDB driver. No forced downgrade or unverified overrides were applied.
The Phase 3 audit found no newly introduced authentication dependency advisories.
Overtime, storage, reporting, and attendance correction workflows remain
out of scope.

## Regular check-in (Phase 5)

`/attendance` reads the authenticated user's open session through the Attendance
service, regardless of calendar date. If none exists, the client form requests a
single fresh high-accuracy browser location (15-second timeout, no cached position)
on explicit user interaction. GPS errors have retry controls; no manual coordinate
entry, background tracking, geocoding, or offline queue exists. Production GPS
requires HTTPS (localhost is allowed by browsers).

`checkInAction` rechecks the current active database identity, validates a strict
Zod input, and invokes the service. Only coordinates, accuracy, device IANA zone,
and optional description are accepted. The service takes the server timestamp
after acquiring a per-user database lock, derives the local calendar date using
Intl, and snapshots the active schedule's `requiredWorkMinutes`. Attendance is
the business evidence record; no duplicate speculative AuditLog event is added.

SQL `DATE` stores `workDate`; Prisma represents it as UTC midnight and the DTO
serializes it as `YYYY-MM-DD`. It is established once at check-in. Event timestamps
are absolute instants; the UI formats check-in using its recorded event zone.
The snapshot remains independent of later schedule edits. Checkout fields remain
nullable until the Phase 6 workflow closes the session.

Every create transaction locks the parent User row using parameterized `FOR UPDATE`
before reading attendance. This serializes check-ins even when concurrent requests
derive different local dates. The service rejects any open session and an existing
user/work-date record. A database unique `(userId, workDate)` constraint protects
same-date races, with P2002 translated into a safe domain error. Future attendance
writers must preserve the parent-lock convention; the open-session invariant is
transaction-enforced rather than a MariaDB partial unique index.

Migration `20260918180000_add_regular_attendance` was generated by comparing the
configured database to the schema, reviewed, then applied with `prisma migrate
deploy`. This needs no shadow database, reset, or broader database permissions.

`npm test` covers input boundaries, date boundaries, DTO safety, and existing tests.
`npm run test:attendance:integration` exercises real MariaDB transactions, concurrent
same- and cross-date requests, snapshot persistence, active-user/schedule checks,
and the unique index, cleaning up its own fixtures. It requires the migrated local
database. `npm run test:auth:integration` additionally needs a running local build.

Phase 5 browser verification used headless Edge at 320, 375, 390, and 430px.
It exercised browser-emulated geolocation success and injected permission-denied,
unavailable, timeout, and unsupported states; location retry; network failure;
stale-page submission after deactivation; successful persistence and reload;
server timestamps; event-zone display; and navigation/content clearance.
All temporary database fixtures were removed. This was browser emulation, not
physical-device GPS testing.

## Daily Report and regular checkout (Phase 6)

`DailyReport` is an optional one-to-one relation on Attendance, with a unique
`attendanceId`, UUID, content, and created/updated timestamps. Reports are distinct
from both event descriptions. Content is trimmed plain multiline text, from 1 to
10,000 UTF-16 code units. Explicit saves upsert the report while the session is
open. Checkout requires a persisted, valid report; unsaved text is insufficient.
Completed reports cannot be edited through the worker workflow.

Check-in, report saves, and checkout all lock the same User row before reading
attendance state inside their transaction. The shared service context also
rechecks active status. This serializes simultaneous checkouts and report/checkout
races. Checkout updates only an open record and cannot overwrite completed event
evidence. Server Actions authenticate before validation and derive both user and
attendance identity server-side. ADMIN-only User actions keep their separate guards.

The shared attendance event form retains the Phase 5 location behavior for both
events. Checkout starts with no coordinates and requires a new acquisition;
check-in location is never reused. It captures its own validated IANA zone and
optional description. Address stays null without reverse geocoding. The service
generates `checkOutAt`, rejects time earlier than check-in, and never changes the
original `workDate`, check-in evidence, or required-minute snapshot.

The DTO derives actual minutes as `floor((checkOutAt - checkInAt) / 60000)` and
difference as those whole elapsed minutes minus the Attendance snapshot. This
truncates partial minutes consistently for presentation; stored timestamps retain
their full precision. Formats include `9h 03m`, `+1h 03m`, `-30m`, and `0m`.
No breaks are deducted and no duration/difference columns are stored. Positive
difference is descriptive regular duration, never automatic overtime.

The page reads the owner's open session first, otherwise the most recently started
completed session. This bounded lookup does not depend on server OS today. A
completed summary survives reload and includes the saved report, both events'
own timezones/GPS, and durations. A collapsed new-session form remains available;
the service continues to reject duplicate work dates while allowing future dates.

Migration `20260918190000_add_daily_report` adds only the DailyReport table, unique
index, and relation. It was reviewed and applied with the existing diff/deploy
workflow, without a shadow database or reset. Before/after verification confirmed
all existing User, WorkSchedule, AuditLog, and Attendance rows remained unchanged.
There is no fabricated report backfill or redundant business audit event.

`npm run test:checkout:integration` covers real MariaDB report saves, uniqueness,
checkout prerequisites, active identity, ownership, negative clock protection,
snapshot preservation, midnight/different zones, future check-in, double checkout,
and report/checkout races. Test fixtures are removed after each run. Unit tests
cover validation, DTO safety, duration precision, and positive/negative/zero
differences. Existing check-in and authentication integration suites still apply.

Browser checks at 320, 375, 390, and 430px cover report save/reload, unsaved-change
gating, fresh checkout GPS, loading/error/retry states, pending checkout, completed
reload, long text wrapping, touch targets, and bottom-navigation clearance. Direct
Server Action checks cover guests, inactive users, injected attendance identity,
missing persisted reports, and post-checkout immutability. GPS is browser-emulated;
physical-device testing over production-like HTTPS remains a deployment check.

Admin attendance monitoring, User Management UI, overtime, photos, reporting,
exports, and attendance correction remain outside Phase 6.

## Admin User Management and Attendance Monitoring (Phase 7)

`/admin/users` now provides server-side name/email search, role/status filters, and
pagination (20 by default, at most 100). `/admin/users/new` and
`/admin/users/[id]/edit` reuse the existing schemas, bcrypt behavior, User service,
and ADMIN-protected actions. Empty edit passwords preserve the existing hash.
The form lists up to 100 active schedules sorted by name, with hours and required
minutes. WorkSchedule CRUD is not added. Account status changes require explicit
inline confirmation; deactivation preserves history and does not close attendance.
Existing audit transactions derive the actor from the authenticated ADMIN action.
The existing domain has no last-admin/self-demotion prohibition; Phase 7 does not
invent one. Self-editing warns that removing ADMIN removes administration access.

`/admin/attendance` provides date-from/to, bounded searchable user selection
(including inactive users), employee name/email search, and open/completed filters.
Default dates are the current month through today in `ADMIN_REFERENCE_TIMEZONE`
(`Asia/Jakarta`), derived through Intl rather than the host OS calendar. The query
filters the stored SQL DATE `workDate`, inclusive at both ends; it does not derive
dates again from event timestamps. URL inputs are validated; malformed inputs
receive a controlled reset-filters view. Ordering is workDate, checkInAt, then id,
all descending. Counts and page reads share a repository transaction.

`/admin/attendance/[id]` independently authorizes active ADMIN access and displays
read-only evidence: both events' recorded timezones, coordinates/accuracy, optional
addresses/descriptions, and multiline Daily Report. Main rows omit bulky evidence.
The dedicated admin DTO extends the existing Attendance mapper with selected safe
employee identity. Neither DTO nor UI contains password hashes. Open attendance
shows no final actual/difference; completed durations reuse the Phase 6 snapshot
and calculation convention. WIB/WITA/WIT supplement the relevant IANA identifiers;
other zones retain their own identifiers. No maps/geocoding, correction, or new
attendance mutation exists in the admin monitoring flow.

The pages and tables are Server Components; forms, confirmations, and user lookup
are small interactive components. Tables scroll within their own containers on
narrow screens. Existing shadcn controls and semantic HTML were sufficient: no
TanStack Table, additional shadcn package, or other dependency was installed.

Migration `20260918200000_index_admin_attendance` adds only the composite
Attendance `(workDate, checkInAt, id)` index for the global date-filtered ordered
query. Existing indexes begin with userId and remain in place. The established
diff/deploy workflow applied it without resets or privilege changes; verification
confirmed all existing rows, including authentication data, were unchanged.

`npm run test:admin:integration` covers User mutations/audit, safe duplicate-email
handling, password preservation, schedules, attendance filters/pagination/order,
detail DTOs, historical snapshots, and inactive-account history. It removes its
temporary fixtures. Query/date/timezone unit tests and the existing worker and
authentication suites also remain part of validation. Admin routes require the
database-backed page guard and User actions independently require ADMIN on every
call, including the bounded user lookup action.

Phase 7 browser verification passed at 375, 768, 1024, and 1440px against the
explicit `127.0.0.1` production server. It covered create/edit and blank-password
preservation, duplicate email feedback, schedule assignment, status confirmation,
audit identity, filters/pagination, inactive history, event-local detail evidence,
long report wrapping, and the worker report/checkout regression. Direct action
requests from guests, USERs, inactive ADMINs, and demoted ADMINs were rejected.
All fixtures were removed. Browser GPS was emulated, not physical-device tested.

For future browser checks, scope table assertions through `getByRole('table')`
(the visible accessible table), then select its rows/cells. After filter or page
navigation, wait for the expected URL and navigation/network activity to settle.
Do not count global `tbody` elements: React streaming can temporarily include
hidden table scaffolding. This verification fix was limited to the test script;
application rendering and authorization were not weakened.

At the end of Phase 7, Overtime Authorization, Overtime Attendance, photo handling,
Admin Overtime Monitoring, Reporting/Export, and attendance correction remained
future phases.

## Phase 8: Overtime authorization

`/admin/overtime` is an authorization workspace for **completed regular attendance**.
It reuses the admin shell, bounded user lookup, pagination, event-local formatting,
duration mapper, historical required-minutes snapshot, and attendance detail pages.
Filters cover stored work-date range, user (including inactive history), employee
name/email, and Not Authorized / Authorized / Revoked. The default range is the
current month through today in Asia/Jakarta. Ordering remains workDate, checkInAt,
id descending; pages default to 20 rows and are limited to 100.

Grant, revoke, and re-authorize require explicit inline confirmation naming the
employee and work date. Grant notes are optional, trimmed, and limited to 1,000
characters; empty notes become null. A re-grant replaces the current note and
grant actor/time, clears revokedAt, and retains the same authorization ID. Previous
values remain in audit metadata. Repeated active grants and repeated revocations
return a safe idempotent result without changing timestamps or adding audit rows.

Migration `20260919000000_add_overtime_authorization` adds only
`OvertimeAuthorization`, with a unique attendanceId, grantedById, server grantedAt,
nullable revokedAt/note, and creation/update timestamps. Work date and target user
are derived from Attendance, not duplicated. Both foreign keys use RESTRICT on
delete. The only additional non-unique index supports the grant actor foreign key;
the existing Attendance range/order index supports workspace queries. The reviewed
diff/deploy migration required no reset, shadow database, or privilege changes.
Before/after fingerprints confirmed every preexisting domain row was preserved.

Mutation flow: client confirmation → Server Action → requireAdmin → strict Zod
schema → service → repositories → MariaDB transaction. Client actor, timestamps,
user ID, and work date are rejected as extra input. The action supplies admin.id.
The service locks actor/target User rows in sorted ID order, then Attendance, before
reading mutable state. It rechecks the actor's database role/active status inside
the transaction. This also serializes transitions before an authorization exists;
the unique attendanceId constraint is additional duplicate protection. Concurrent
grant/revoke operations take effect in lock order; the last actual transition
determines final state. Existing regular attendance locks remain compatible.

New grants and re-grants require an active target user; ADMIN targets and self-grants
are allowed under existing attendance rules. Deactivation preserves history, and
revoking an inactive target remains allowed. No duration threshold grants or denies
authorization. Grant/revoke never writes User, WorkSchedule, Attendance, or DailyReport.

Audit writes share the mutation transaction. Actions are
`OVERTIME_AUTHORIZATION_GRANTED`, `OVERTIME_AUTHORIZATION_REVOKED`, and
`OVERTIME_AUTHORIZATION_REGRANTED`, with entity type `OvertimeAuthorization`, its ID,
the actual admin actor, and metadata containing attendanceId, targetUserId, original
workDate, authorizationId, note, grantedAt, and revokedAt. Only `/admin/overtime`
is revalidated by these actions. Safe DTOs explicitly select identities and contain
no password hashes. The workspace is server-rendered; confirmation controls and
the reused user search are the interactive boundaries.

Validation commands:

```bash
npm test
npm run test:overtime-authorization:integration
npm run test:attendance:integration
npm run test:checkout:integration
npm run test:admin:integration
npm run test:auth:integration
```

The opt-in production browser suite is
`tests/overtime-authorization.browser.mjs`. Start a production build on the explicit
local IPv4 address, set `PLAYWRIGHT_MODULE_PATH` to your test environment's Playwright
`index.mjs`, and optionally `BROWSER_EXECUTABLE` to an installed browser. Run:

```bash
node --conditions=react-server --import tsx tests/overtime-authorization.browser.mjs
```

`TEST_BASE_URL` defaults to `http://127.0.0.1:3000` and only permits a local host.
For the HTTP auth regression, set process-local `NEXTAUTH_URL` to that same address.
Do not edit `.env`. Playwright is test-environment tooling, not a new app dependency.
Both Phase 8 integration suites create uniquely named fixtures and remove them in
finally blocks. Browser assertions target the visible accessible table, wait for
expected navigation and rendering, and cover 375/768/1024/1440px, pending/error
feedback, lifecycle, read-only details, and direct action denial/spoofing checks.
Set optional `TEST_SCREENSHOT_DIR` to retain fixture-only screenshots outside the
repository. Production verification passed at all four widths, including keyboard
focus restoration and the removal of re-authorized rows from the Revoked filter.
Detail assertions wait for the visible heading/evidence after streamed navigation;
the test timing fix does not alter application rendering. All 28 unit tests, all
four database integration suites, and the authentication HTTP regressions passed.

### Contract for Phase 9 (not implemented)

Use the persisted Attendance ID as the authorization key. An eligible worker must
be authenticated/active, own completed regular Attendance, and have a related
OvertimeAuthorization whose revokedAt is null. Its original Attendance.workDate
remains authoritative even across midnight or timezone changes. Do not use positive
duration difference or a cached UI state as permission. The repository
`findAuthorizationAttendance(attendanceId, tx)` returns explicitly selected regular
evidence and authorization; the mapper `toAuthorizationAttendanceDto` derives
Not Authorized / Authorized / Revoked. The Phase 8 list service
`listOvertimeAuthorizations` requires an ADMIN-protected caller. Phase 9 must enforce
worker ownership independently and coordinate its transaction with the same parent
User/Attendance locks before checking authorization, so a concurrent revoke is
ordered against starting activity. If multiple users are locked, preserve sorted
ID ordering. Do not invoke admin actions from worker workflows.

The USER `/overtime` page remains a placeholder. No Overtime activity model,
check-in/out, GPS workflow, photos, camera, watermark/storage, overtime monitoring,
reporting/export, or attendance correction is implemented in Phase 8.

## Phase 9: Worker overtime and photo evidence

`/overtime` reconstructs unavailable, authorized, open, and completed states from
the database. Open overtime always takes priority, even if a later regular
attendance exists. Otherwise only the latest regular attendance by server
checkInAt and ID descending is considered. It must be completed, owned by the
active current user, and have an active authorization with no overtime activity.
Older unused authorizations are intentionally not selected as a fallback. The
worker never submits an attendance/authorization/overtime ID, work date, timestamp,
duration, or photo path. Administrative authorization remains the Phase 8 workspace.

Migration `20260919010000_add_overtime_attendance` adds `Overtime` with a unique
authorizationId, restrictive authorization foreign key, and a checkOutAt index.
Each event stores its own absolute timestamp, GPS, accuracy, IANA timezone,
required description, and relative photo key; checkout fields are null while open.
Optional addresses are currently null; no reverse geocoder is introduced.
Ownership and work date remain normalized through Overtime → OvertimeAuthorization
→ Attendance → User. The original Attendance.workDate is never recalculated.
The reviewed additive migration preserved every existing record, verified with
before/after fingerprints of all six existing domain tables. No reset or fabricated
historical overtime was needed.

### Mutations, locking, and file consistency

Both Server Actions require the current database-backed active user and parse
strict FormData. Descriptions trim to 1–1,000 characters. GPS/timezone validation
and browser acquisition reuse regular attendance conventions: high accuracy,
15-second timeout, zero cached-position age, explicit error/retry, no fake fallback.
Both events need independent location, description, and photo input.

The service performs an initial eligibility/owner check, generates a server event
timestamp, processes the image, and writes a new generated storage key. It then
locks the active User row and relevant Attendance row using Phase 8 conventions,
re-resolves current state, and creates/closes the overtime in a transaction. Image
processing and file writes do not hold database locks. A changed selection,
deactivation, revocation, existing activity, or competing open session is rejected
at final validation. Unique authorizationId provides additional duplicate protection.
Checkouts use the owner's open overtime, not the checkout calendar date, and guard
against overwriting an already closed record. Check-in time cannot precede regular
checkout; overtime checkout cannot precede overtime check-in.

Revocation prevents starting; it does not prevent an active owner closing overtime
that already started. Deactivation does not fabricate checkout or delete evidence.
Overtime elapsed whole minutes use absolute timestamp subtraction with no breaks,
required-overtime duration, regular shortfall compensation, or merged totals.

If final database validation/transaction fails, the newly written photo is deleted
without touching existing evidence. Mapping is outside compensation's scope after
commit. Delete is idempotent for missing files; a failed compensation logs a generic
maintenance error. Filesystem and MariaDB cannot commit atomically: an abrupt process
or host crash can still leave an orphan requiring maintenance. No background cleanup
or historical-evidence deletion UI is added in this phase.

### Photo pipeline and private storage

`sharp` 0.35.4 is a direct server dependency. Actual decoded formats accepted/tested
are single-image JPEG, PNG, and WebP. Client MIME, filename, extension, EXIF clock,
and EXIF GPS are not authoritative. HEIC/HEIF, animated images, SVG, corrupt files,
and unsupported images fail safely. Inputs are capped at 10 MiB and 40 million
decoded pixels. Installed Next.js 16.3.5 defaults Server Action bodies to 1 MB;
`experimental.serverActions.bodySizeLimit: "12mb"` permits multipart overhead while
the application still limits the individual file to 10 MiB.

Processing auto-rotates, resizes inside 1600×1600 without upscaling, flattens
transparency, adds a bottom dark-backed watermark, and writes metadata-stripped JPEG.
Images below 240×180 after rotation are rejected for evidence readability. JPEG
qualities 82/74/66/58 are tried toward a 1 MiB target; output above the hard 2 MiB
ceiling is rejected. Originals are processed in memory and are not retained.

Watermark fields are event type (ETime - Overtime Check-In/Check-Out), local date/time
from the exact persisted server event timestamp, recorded IANA timezone with
WIB/WITA/WIT where applicable, latitude/longitude to six decimals, GPS accuracy,
and optional address. Foreign zones retain their IANA identifier. Descriptions
are not rendered into the watermark. Database metadata remains authoritative.

`StorageService` exposes upload/read/delete; `LocalStorage` lazily uses STORAGE_ROOT.
Missing/unwritable configuration fails the actual operation safely; builds do not
write evidence. Keys use the original attendance work date:

```text
attendance/overtime/YYYY/MM/DD/{userId}/checkin-{uuid}.jpg
attendance/overtime/YYYY/MM/DD/{userId}/checkout-{uuid}.jpg
```

Strict key validation rejects traversal, absolute paths, backslashes, and trailing
whitespace. Parent directories and target files cannot be symlinks; a public-root
configuration is rejected. A private temporary file is written completely, then a
hard link publishes it without replacing an existing key; the temporary name is
removed. The local filesystem must support hard links. `/storage` is gitignored.

Delivery URLs are separate from storage keys: `overtimePhotoUrl` returns
`/api/overtime/{id}/photo/{check-in|check-out}`. The Node route authenticates, and
`readOvertimePhoto` verifies the active owner's persisted relationship before
reading a file. Other users receive not-found; guests/inactive users receive
unauthenticated. Responses are JPEG with fixed disposition, Content-Length,
`nosniff`, and private/no-store caching. Evidence never goes under unrestricted
`public`, through the public image optimizer, or into database blobs/base64.

Deployment needs persistent writable private storage. An ephemeral serverless
filesystem is not durable evidence storage. No cloud provider is implemented.

### Verification and Phase 10 contract

`tests/overtime-photo.test.ts` uses generated in-memory images and temporary
directories. `npm run test:overtime:integration` exercises actual processing and
storage, lifecycle/ownership, both duplicate-event races, interleaved authorizations,
revocation during upload and after start, historical evidence, timezone/duration,
and fault-injected transaction failures with compensating cleanup. Tests never use
production STORAGE_ROOT. The existing Phase 8 and regular-attendance suites remain
part of regression verification.

`tests/overtime.browser.mjs` uses environment-supplied Playwright/Edge like Phase 8.
Start a production server with a process-local STORAGE_ROOT pointing to an isolated
directory directly under the OS temp directory, named `etime-phase9-browser-{uuid}`.
Set TEST_STORAGE_ROOT to the same directory for the test, PLAYWRIGHT_MODULE_PATH to
Playwright's index.mjs, and optionally BROWSER_EXECUTABLE, TEST_BASE_URL, and
TEST_SCREENSHOT_DIR. Run `node --conditions=react-server --import tsx
tests/overtime.browser.mjs`. Do not edit `.env`. It uses emulated GPS and generated
photo uploads; this is not physical camera/GPS verification. All fixtures/photos
are scoped to the test and cleaned up. Assertions await visible current content
after streamed navigation and wait for pending requests before removing interceptors.

Phase 10 should reuse Overtime → Authorization → Attendance → User, the original
Attendance.workDate, event-specific timezone/GPS/description/photo fields, and
`toOvertimeDto`'s separate duration/open-state derivation. DTOs contain protected
photo URLs rather than storage keys or absolute paths. Extend the photo service's
authorization policy explicitly for database-backed active ADMIN access; do not
expose storage publicly or bypass the existing owner check. No admin activity
list/detail/photo/duration monitoring, reports/exports, corrections, cloud storage,
or break deductions are implemented here.

Phase 9 verification passed: 32 unit tests, all five database integration suites,
authentication HTTP regressions, the Phase 8 production browser suite, and the
Phase 9 mobile browser suite at 320/375/390/430px. The browser uploaded a generated
2,333,916-byte JPEG and received 952,472-byte processed evidence, exercising both
the increased request limit and adaptive compression. Direct guest, unauthorized
worker, and inactive-owner action requests were rejected. Photos were denied to
other users/guests/inactive owners. Regular check-in/report/checkout also passed
in the browser after geolocation reuse. These checks used emulated GPS and generated
uploads, not a physical camera or GPS device.

## Phase 10: Read-only admin overtime monitoring

`/admin/overtime` remains the grant/revoke/re-grant authorization workspace.
Its Authorization/Activity navigation links to `/admin/overtime/activity`, which
lists actual Overtime records, and `/admin/overtime/activity/[id]`, which shows
recorded evidence without editing. Both new pages independently call
`requirePageUser(true)` and therefore the established database-backed ADMIN guard.

The activity page reuses attendance filter and pagination components. Validated
URL parameters are `from`, `to`, `userId`, `search`, `state` (`all`, `open`,
`completed`), `page`, and `pageSize` (maximum 100). The default range is the first
day of the current month through today in Asia/Jakarta. Date predicates use
Overtime → OvertimeAuthorization → Attendance.workDate, never an overtime event's
calendar date. Ordering is workDate descending, checkInAt descending, then ID
descending. Repository reads select related authorization, attendance and safe
employee fields together with bounded results and a count; there are no per-row
service lookups. Inactive employees and revoked authorizations remain visible.

`listAdminOvertime` and `getAdminOvertimeDetail` are internal server-only read
services for independently ADMIN-protected callers. `AdminOvertimeDto` extends
the worker evidence DTO with factual Open/Completed state, safe employee identity,
regular attendance ID and authorization ID/grantedAt/revokedAt/note. It exposes
protected photo URLs, not storage keys, filesystem paths or password hashes.
Details reuse the overtime evidence summary and link to regular attendance.

Each event renders its own timezone, coordinates, accuracy, optional address,
description and processed photo. Completed duration reuses absolute timestamp
subtraction, floored to whole minutes, without breaks. Open rows have no final
duration or checkout evidence. Regular and overtime durations remain separate.
The original Attendance.workDate survives cross-midnight/multi-timezone events.

### Photo policy extension

The existing `/api/overtime/[id]/photo/[event]` route is unchanged. Its service now
allows the active owner **or a current database-backed active ADMIN**. Other USERs
and non-owning demoted ADMINs receive not-found; guests and inactive accounts are
unauthenticated. A demoted administrator still has ordinary owner access to their
own evidence. No public endpoint, arbitrary-key access or storage-provider change
was introduced. Existing validation, normalized JPEG delivery and private/no-store
headers remain intact. The small shared `EvidencePhoto` client component renders
an unavailable message when a photo request fails, preserving readable details.

### Verification

`npm run test:admin-overtime:integration` covers filters, pagination and deterministic
ties; safe details; open/completed duration; multiple timezones and cross-midnight
work dates; inactive/revoked history; current-role photo access; missing files; and
unchanged evidence/audits after reads. Fixtures use real worker services, including
grant → check-in → revoke → checkout, and isolated temporary photo storage.

`tests/admin-overtime.browser.mjs` exercises the production application at
375/768/1024/1440px. It covers Authorization/Activity navigation, current visible
tables after streamed navigation, filters, pagination, detail evidence, missing
photos, stale ADMIN sessions and photo ownership. It uses the same environment
variables and isolated `etime-phase9-browser-{uuid}` storage convention documented
above so the Phase 8/9 browser regressions can run against the same production
server. Fixtures and photo files are removed in `finally`; optional screenshots
belong in temporary storage and should be removed after review.

No dependency, Prisma schema change or migration is required for Phase 10.

Phase 10 verification passed: 32 unit tests, all six database integration suites,
authentication HTTP regressions, and the Phase 8, Phase 9 and Phase 10 production
browser suites. Admin monitoring was checked at 375/768/1024/1440px without
page-level horizontal overflow; wide tables retain their own scroll container.
The Phase 9 regression also exercised a generated 2,333,287-byte upload processed
to 952,297 bytes. Browser GPS and camera inputs were emulated, not physical-device
tests. Lint, typecheck, Prisma validation/generation, migration status and production
build passed; all six existing migrations were current.

### Contract for Phase 11 (not implemented)

Reuse the validated monitoring query fields and normalized workDate relationship,
safe employee/authorization/event DTO fields, event-local formatter and separate
absolute duration derivation. A future reporting/export boundary must independently
authorize ADMIN access and preserve bounded query behavior; do not treat UI filters
as authorization. Phase 10 adds no reporting, export, Excel/CSV/PDF, charts,
corrections, post-overtime approval, photo mutation UI, merged duration or cloud
storage implementation.

## Phase 11: Reporting and Excel export

`/admin/reports` is a factual, read-only report with one row per Attendance. It
reuses the ADMIN shell, attendance filter form, pagination, event-local formatters,
regular duration/snapshot mapper and overtime evidence mapper. The report service
uses a repository selection of Attendance → User/DailyReport/OvertimeAuthorization
→ Overtime, without per-row queries or a persisted Report model. Existing regular
and overtime detail links remain the evidence views.

Filters are `from`, `to`, `userId`, employee `search`, and regular attendance `state`
(`all`, `open`, `completed`). The validated query schema shares Phase 7 semantics:
current month through today in Asia/Jakarta by default; preview pagination bounded
to 100 rows; deterministic workDate/checkInAt/ID descending order. Date filtering
always uses Attendance.workDate. Inactive-worker and revoked-authorization history
is included. Historical requirements use Attendance.requiredWorkMinutes, not the
current schedule. Open regular/overtime records have no fabricated final duration.

### XLSX delivery and safety

ExcelJS 4.4.0 generates the `Attendance Report` worksheet with title, filter
metadata, frozen/filterable headers, wrapped multiline text and numeric minutes.
Columns include identity/workDate, regular event-local timestamps/timezones,
coordinates/accuracy/optional address/descriptions, actual/required/difference,
Daily Report, authorization state/UTC grant and revoke instants/note, and overtime
events/descriptions/separate duration. Work dates are ISO date strings. Event-local
timestamps use the existing IANA/WIB/WITA/WIT formatter. Photos and photo URLs are
omitted from Excel; protected application evidence delivery is unchanged.

`GET /api/reports/export` independently calls `requireAdmin()` and validates all
filters, including duplicate query values. Guests receive 401, active non-ADMINs
403, and invalid filters 400. Current database role/status overrides stale JWTs.
The page independently uses the same established ADMIN page guard. DTOs contain
no password hashes or storage keys. Responses use private/no-store, nosniff, the
XLSX MIME type and a filename made only from validated date values.

Export ignores UI page/pageSize. `MAX_REPORT_EXPORT_ROWS` is 1,000: the repository
reads at most limit+1 matching rows, then the service rejects overflow with a clear
request to narrow the filters. There is no silent truncation or count/read race.
Empty results generate a valid headers-only workbook. Excel generation checks the
same limit. All string cells pass through `sanitizeExcelText`; leading formula
triggers (also after whitespace/control characters) are prefixed with an apostrophe
and stored as strings, while ordinary text/newlines are preserved. No formula or
hyperlink objects are created from user input. The small download component shows
pending, success and safe error feedback; ExcelJS stays on the server.

### Focused verification and manual acceptance

`tests/report.test.ts` covers filter errors, export-limit boundaries, literal text
and a valid empty workbook. `npm run test:report:integration` reuses existing
UUID-scoped overtime fixtures to verify historical requirements, separate
durations, cross-midnight work dates, inactive/revoked history, open sessions,
one row per attendance, all-page export, workbook values/newlines and unchanged
evidence. The existing authentication HTTP suite now covers independent export
authorization, stale ADMIN roles/status and invalid export parameters.

Phase 11 validation passed: lint, typecheck, Prisma validate/generate, six current
migrations, 34 unit tests, the focused reporting integration test, all six existing
database integration suites, the authentication HTTP suite and one production
build. Existing regressions ran once at final validation. No browser automation
was run for this phase; detailed visual/download acceptance remains with the owner.

Detailed browser/UI acceptance is intentionally manual for this phase:

- [ ] ADMIN opens Reports and sees the current-month default.
- [ ] Date, employee/search and regular-state filters apply/reset correctly.
- [ ] Pagination works; regular data, Daily Report and overtime context match evidence.
- [ ] Event-local labels and open-session blanks are correct.
- [ ] Excel downloads all matching rows across pages; multiline text is readable.
- [ ] More than 1,000 matches returns a clear error rather than a partial file.
- [ ] Inactive-worker history remains reportable; USER cannot access reports/export.
- [ ] Mobile/tablet/desktop layout is usable.

No schema change or migration is required. No PDF/CSV, payroll, analytics/rankings,
corrections, approval workflow or cloud-storage migration is added.

### Notes for Phase 12 (not implemented)

Complete the owner's browser/download acceptance and assess the 1,000-row limit
against deployment memory and realistic report sizes. Dependency audit currently
reports 11 production dependency findings (6 moderate, 5 high), including existing
Prisma/MariaDB chains and ExcelJS's transitive uuid advisory. The installed ExcelJS
code uses uuid v4 for conditional-format identifiers; the reported uuid issue
concerns v3/v5/v6 with a supplied buffer, which this report generator does not use.
Dependency remediation requires separate compatibility review; no broad upgrades
or Phase 12 hardening were performed here.

## Approved post-Phase-11 domain adjustment

This section supersedes earlier clock-schedule and worker-facing required-duration
descriptions. Company position is separate from system role: User.position is
nullable, trimmed, limited to 100 characters, and blank input becomes null. Admin
create/edit forms and safe user DTOs include it; user-update audits record the
resulting position. Position has no authorization effect.

WorkSchedule now contains a name, integer requiredWorkMinutes and active status,
with no startTime/endTime fields or late/early classification. Admins manage these
policies at `/admin/users/work-schedules`, linked from Users. Policy changes affect
new regular check-in snapshots only. Historical Attendance.requiredWorkMinutes,
actual/difference calculations and separate overtime duration remain unchanged.
Fresh seeds use `Standard 8 Hours` with 480 minutes. An existing seeded ADMIN keeps
its identity and assigned policy; the idempotent seed does not recreate or rename
legacy policy rows.

Migration `20260919020000_duration_policy_and_position` adds nullable User.position
and drops only WorkSchedule.startTime/endTime. It does not recreate rows, reset the
database or touch attendance snapshots. Before/after hashes of all seven domain
tables matched after excluding only these approved removed/new columns.

### Geoapify setup and behavior

Configure `GEOAPIFY_API_KEY` as a **server-only** deployment secret (placeholder in
`.env.example`). The real `.env` was not changed. Missing configuration returns a
null address immediately; set the key to enable real address lookups. No SDK or new
dependency is required. The replaceable `ReverseGeocoder` function uses native
fetch against Geoapify's reverse endpoint, with validated latitude/longitude,
JSON format and one result. The key never enters client code, DTOs, or error text.

`resolveEventAddress` bounds the entire provider request/body parse with a
**2,500 ms timeout**. On timeout it aborts the fetch and resolves null; the caller
also stops waiting even if a replacement provider ignores abort. Network/HTTP
errors (including rate limiting), malformed responses, empty results and other
provider exceptions all resolve null without blocking attendance. There are no
automatic retries, historical lookups, bulk backfills, new caches or Redis.

Successful formatted addresses collapse whitespace/control characters, trim and
deduplicate comma-separated components case-insensitively, and are capped at
500 Unicode characters. Addresses are derived convenience evidence; persisted GPS
coordinates and accuracy remain authoritative. All four event services invoke the
same resolver **outside database transactions**, then persist the address with the
event. Worker schemas reject arbitrary client address fields. Final active-user,
state, concurrency and overtime authorization checks remain intact.

Overtime passes the same server-derived address to both structured persistence
and the existing image watermark pipeline. Failed lookups still produce valid
coordinate-based photos. Existing photos and historical nullable addresses are
untouched. Address displays include Geoapify attribution, also included in new
address-bearing watermarks and report workbook metadata. If replacing the provider,
update attribution to match that provider's terms.

Geoapify currently documents one credit per reverse request, with a free-plan
allowance of 3,000 credits/day and up to 5 requests/second; paid-plan limits differ.
Choose a plan for peak attendance bursts and monitor its quota. An over-limit
response degrades to null address rather than delaying/rejecting attendance.
See [reverse-geocoding documentation](https://apidocs.geoapify.com/docs/geocoding/reverse-geocoding/)
and [current usage/pricing terms](https://www.geoapify.com/pricing/).

### Location and Home

Worker evidence screens show the saved address when available, with a nullable
fallback and retained GPS/accuracy. Admin regular/overtime details reuse a location
component and a coordinate-based Google Maps search link, with no embedded map or
API key. Report/export locations continue using saved event snapshots.

Home shows employee name/position and regular Not Checked In, Active or Completed
state. An open session wins even when its workDate is older. Otherwise the server
resolves the current business date in Asia/Jakarta, using the established reference
timezone; each displayed event still uses its own recorded timezone. A previous
completed day's record is not presented as today's attendance. Home links to the
Attendance workflow without adding mutations. Attendance actions revalidate Home.
Worker profile/summary views no longer display role as position, schedule clock
times, required duration, or duration difference. ADMIN monitoring retains these
historical duration comparisons.

### Focused verification and owner acceptance

`tests/domain-adjustment.test.ts` covers position/policy validation, client-address
rejection, maps coordinates, mocked Geoapify responses, malformed/error responses
and timeout/abort behavior. `test:domain-adjustment:integration` uses isolated
fixtures to exercise position persistence/audit, duration-policy changes, a valid
11:00–19:00 session, historical snapshots, Home states, previous-date open priority,
all four successful address snapshots/watermark input and all four failure paths.
Database regression suites disable real geocoding; focused tests inject mocks.

- [ ] ADMIN creates/edits a position, including blank; duration policies have no clock fields and required minutes remain configurable.
- [ ] Home shows name/position, no system-role job title or required hours, and correct Not Checked In/Active/Completed states including an older open session.
- [ ] Regular GPS and non-editable addresses work; check-in/checkout still work during provider failure and accept flexible clock times.
- [ ] Overtime addresses and watermark work for both events, including provider failure fallback.
- [ ] Admin evidence shows address/GPS/accuracy and Open in Maps targets the saved coordinates.
- [ ] Report preview, historical required duration, Excel export, filters and pagination remain correct.

Detailed browser acceptance is manual. This adjustment does not redesign USER or
ADMIN UI or begin Phase 12, and adds no fixed shifts, judgments, geofencing,
payroll, correction workflows or unrelated features.

Final adjustment validation passed: 36 automated unit tests; all eight database
integration suites (adjustment, attendance, checkout, admin, overtime authorization,
overtime, admin overtime and reporting); production HTTP authentication/authorization
regressions including the duration-policy route; lint; typecheck; Prisma validation
and generation; migration status (all seven applied); and production build.
The migration was deployed without reset. Before/after fingerprints confirmed
preservation of existing data in all seven domain tables, including historical
required-minute snapshots; the idempotent seed and database-test cleanup preserved
those fingerprints too. No browser automation or live geocoding requests were run.
Temporary verification files and the owned production test server were removed or
stopped. The real `.env` and current owner-provided `AGENTS.md` remained unchanged.
