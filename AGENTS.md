# ETime — AGENTS.md

## 1. Project Overview

ETime is an internal workforce attendance and activity management web application for Enneaphos Group.

The application is primarily used by field workers from mobile devices, while administrators primarily use desktop or tablet devices for monitoring and management.

ETime manages:

* User authentication and authorization
* User management
* Regular attendance
* Daily work reports
* Working duration
* Overtime authorization
* Overtime attendance
* GPS/location evidence
* Overtime photo evidence
* Administrative monitoring
* Reporting and export
* Audit trail

The application must remain maintainable, modular, strongly typed, and easy to extend.

---

# 2. Technology Stack

Core stack:

* Next.js
* App Router
* React
* TypeScript
* Tailwind CSS
* shadcn/ui
* Prisma ORM
* MariaDB
* Zod

Project conventions:

* No `src/` directory
* Use App Router
* Prefer Server Components
* Use Client Components only when browser/client interactivity is required
* Use Server Actions for application mutations and appropriate server-side operations
* Keep strict TypeScript typing
* Avoid `any` unless absolutely unavoidable and documented

Additional libraries may be introduced only when they provide clear value.

Do not replace the established stack or architectural pattern without explicit instruction.

---

# 3. Architecture

ETime follows a layered modular-monolith architecture similar to CKMS.

Primary data flow:

```text
UI / Page
    ↓
Server Action
    ↓
Zod Schema
    ↓
Service
    ↓
Repository
    ↓
Prisma
    ↓
MariaDB
```

Return flow may use DTOs/mappers:

```text
MariaDB
    ↓
Prisma
    ↓
Repository
    ↓
Service
    ↓
Mapper / DTO
    ↓
Server Action
    ↓
UI
```

Each layer has a specific responsibility.

Do not bypass architectural layers for convenience.

---

# 4. Layer Responsibilities

## 4.1 UI / Pages / Components

Responsibilities:

* Render application state
* Collect user input
* Handle browser-specific interactions
* Invoke Server Actions
* Display validation and application errors
* Provide loading, success, and error feedback

Rules:

* Pages/components must never access Prisma directly.
* Pages/components must not contain core business rules.
* Prefer Server Components by default.
* Use `"use client"` only when required.
* Keep Client Component boundaries as small as practical.
* Mobile user workflows must be designed mobile-first.
* Admin interfaces may prioritize desktop/tablet layouts.

Examples of client-only behavior:

* GPS/geolocation
* Camera access
* Image preview
* Interactive dialogs
* Form interaction requiring browser state
* Browser APIs

---

## 4.2 Server Actions

Server Actions are application boundaries between UI and domain logic.

Responsibilities:

* Authenticate the current user
* Perform authorization checks where appropriate
* Parse and validate incoming data using Zod
* Call services
* Revalidate paths/tags after successful mutations where required
* Convert known errors into a consistent action response

Server Actions must remain thin.

Do not:

* Query Prisma directly
* Implement substantial business rules
* Duplicate service logic

Preferred response shape:

```ts
type ActionResult<T = undefined> = {
  success: boolean
  message: string
  data?: T
  fieldErrors?: Record<string, string[]>
}
```

Do not expose raw database or internal errors to users.

---

## 4.3 Schemas

Zod schemas define input boundaries.

Responsibilities:

* Validate form input
* Normalize strings where appropriate
* Validate coordinates and other structured input
* Define reusable input types

Use inferred types where appropriate:

```ts
type Input = z.infer<typeof schema>
```

Business rules that require database state do not belong exclusively in Zod.

Example:

Zod may verify that a description is a valid string.

The service must determine whether the user is actually allowed to check out.

---

## 4.4 Services

Services contain business logic and orchestrate domain operations.

Responsibilities:

* Enforce attendance rules
* Enforce overtime rules
* Coordinate repositories
* Calculate durations
* Handle domain state transitions
* Coordinate storage operations
* Perform transaction-sensitive operations
* Throw meaningful domain/application errors

Services must not depend on UI concerns.

Business rules must not be duplicated in components or repositories.

---

## 4.5 Repositories

Repositories are the persistence layer.

Responsibilities:

* Prisma queries
* Database reads
* Database writes
* Aggregation queries
* Persistence-oriented transaction operations

Repositories should describe data operations rather than business decisions.

Good examples:

```text
findUserById
findOpenAttendanceByUserId
findAttendanceByUserAndWorkDate
createAttendance
updateAttendanceCheckout
findOvertimeAuthorization
```

Avoid business-oriented repository methods such as:

```text
checkIfUserCanDoOvertime
decideIfAttendanceIsValid
```

Those belong in services.

No Prisma queries outside repository/infrastructure code unless explicitly justified.

---

# 5. Suggested Project Structure

Use this structure as the default direction:

```text
app/
├── (auth)/
│   └── login/
│
├── (user)/
│   ├── home/
│   ├── attendance/
│   └── overtime/
│
├── (admin)/
│   ├── dashboard/
│   ├── users/
│   ├── attendance/
│   ├── overtime/
│   └── reports/
│
└── ...

actions/
├── auth/
├── users/
├── attendance/
├── overtime/
└── reports/

services/
├── auth.service.ts
├── user.service.ts
├── attendance.service.ts
├── overtime.service.ts
└── report.service.ts

repositories/
├── user.repository.ts
├── attendance.repository.ts
├── daily-report.repository.ts
├── overtime.repository.ts
└── overtime-authorization.repository.ts

schemas/
├── auth.schema.ts
├── user.schema.ts
├── attendance.schema.ts
├── daily-report.schema.ts
└── overtime.schema.ts

components/
├── ui/
├── shared/
├── attendance/
├── overtime/
└── admin/

mappers/
types/

lib/
├── auth/
├── authorization/
├── storage/
├── date-time/
└── utils/

prisma/
├── schema.prisma
└── seed.ts

public/
```

Do not create duplicate architectural trees.

Before creating a new helper, service, repository, schema, component, or utility, check whether an appropriate existing implementation can be extended.

---

# 6. Roles

ETime initially has two application roles:

```text
ADMIN
USER
```

## USER

Users can:

* View their profile/basic information
* Perform regular attendance
* Submit daily reports
* View relevant personal attendance information
* Perform overtime only when authorized

## ADMIN

Admins can:

* Manage users
* Activate/deactivate users
* Monitor attendance
* View daily reports
* Monitor work duration
* Grant/revoke overtime authorization
* Monitor overtime
* View overtime evidence
* Filter reports
* Export reports
* View relevant audit information

`ADMIN` and `USER` are application authorization roles only. They must not be used as the employee's company job title or position.

A user may have a nullable company `position` such as `Site Engineer`, `Project Manager`, `Finance Staff`, or `Supervisor`. Position is descriptive employee information and does not grant application permissions. Empty position input should be normalized to `null`.

Authorization must always be enforced server-side.

Hiding a button is not authorization.

---

# 7. User Status

Users may be active or inactive.

Inactive users must not be able to perform protected application operations.

The server is responsible for enforcing user status.

Do not rely solely on UI state.

---

# 8. Regular Attendance Domain

Regular attendance represents a user's normal working session.

Basic flow:

```text
No Attendance
    ↓
CHECK IN
    ↓
Working
    ↓
DAILY REPORT
    ↓
CHECK OUT
    ↓
Completed
```

## 8.1 Regular Check-In

Regular check-in requires:

* Authenticated active user
* GPS/location available
* Latitude
* Longitude
* Location accuracy
* Event timezone
* Server-generated timestamp

Description is optional.

The client must not be the authoritative source of the event timestamp.

The server determines the official timestamp.

A user must not create multiple simultaneously open regular attendance sessions.

---

## 8.2 Daily Report

After regular check-in, the user must provide a daily report describing work performed that day.

Daily report is required before regular checkout.

Daily report and checkout description are different concepts.

Daily report:

> What work did the user perform today?

Checkout description:

> Optional contextual information related to ending the work session.

Do not merge these fields.

---

## 8.3 Regular Checkout

Regular checkout requires:

* Existing open attendance
* GPS/location available
* Latitude
* Longitude
* Accuracy
* Event timezone
* Completed/non-empty daily report
* Server-generated timestamp

Checkout description is optional.

The service must reject checkout when the daily report requirement has not been satisfied.

---

# 9. Work Date

`workDate` represents the local calendar date associated with the regular attendance session.

The work date is determined at regular check-in using the event timezone.

Once created, `workDate` must remain stable for that attendance session.

Example:

```text
Check In
17 Sep 2026 23:30 WIB

Check Out
18 Sep 2026 08:30 WITA

workDate
17 Sep 2026
```

Checkout on another calendar date or timezone must not automatically move the attendance to another work date.

When checking out, prefer finding the user's currently open attendance rather than assuming it belongs to "today" in the checkout timezone.

---

# 10. Time and Timezone Rules

Time handling is critical.

## 10.1 Timestamp Authority

Official event timestamps must come from the server.

Never trust a client-provided clock as the authoritative attendance timestamp.

Store timestamps as UTC-compatible absolute timestamps through Prisma/database handling.

Examples:

```text
checkInAt
checkOutAt
createdAt
updatedAt
grantedAt
```

---

## 10.2 Event Timezone

Timezone is event-based because field workers may move between regions.

A regular check-in and regular checkout may legitimately use different timezones.

The same applies to overtime.

Example:

```text
Check In
Asia/Jakarta

Check Out
Asia/Makassar
```

Use IANA timezone identifiers where possible:

```text
Asia/Jakarta
Asia/Makassar
Asia/Jayapura
```

For the initial implementation, the browser/device timezone may be used as the event timezone.

Example:

```ts
Intl.DateTimeFormat().resolvedOptions().timeZone
```

Timezone must not be used to calculate elapsed work duration.

---

## 10.3 Duration

Regular work duration:

```text
regular checkout UTC timestamp
-
regular check-in UTC timestamp
```

Overtime duration:

```text
overtime checkout UTC timestamp
-
overtime check-in UTC timestamp
```

Do not subtract breaks.

Do not implement pause/resume unless explicitly requested later.

Do not accept duration calculated by the client as authoritative.

---

# 11. GPS / Location Rules

GPS is required for:

* Regular check-in
* Regular checkout
* Overtime check-in
* Overtime checkout

Capture at least:

```text
latitude
longitude
accuracy
```

Coordinates remain the primary and authoritative location evidence.

For new attendance events, the server should attempt reverse geocoding from validated coordinates and persist a human-readable address snapshot when available. Persisted attendance addresses must be derived server-side rather than trusted from arbitrary user-entered/client-controlled address text.

Reverse-geocoded addresses are derived convenience evidence. Failure, timeout, rate limiting, malformed provider responses, or absence of an address must not block attendance when valid GPS coordinates and accuracy have been obtained. In that case, persist the coordinates/accuracy and allow the address to remain null.

Use a shared reverse-geocoding abstraction for regular check-in, regular checkout, overtime check-in, and overtime checkout. Provider-specific infrastructure must not be embedded directly in UI components, repositories, or Prisma code.

Existing records with null addresses remain valid. Do not dynamically reverse-geocode historical records every time they are displayed.

The UI must not allow attendance submission until required location information has been successfully obtained.

The server must validate coordinates even if the UI already validated them.

Handle browser states such as:

* Permission denied
* Position unavailable
* Timeout
* Unsupported browser/API

Do not silently substitute fake/default coordinates.

---

# 12. Work Duration / Required Duration

Admins need to compare actual attendance duration with the expected work duration.

Actual duration is derived from check-in/check-out timestamps.

Example:

```text
Check In       08:02
Check Out      17:05

Actual         9h 03m
Required       9h 00m
Difference    +0h 03m
```

Break time is NOT deducted.

Do not hard-code expected duration throughout business logic.

Expected/required duration should be configurable through the appropriate work schedule/domain model.

`WorkSchedule` defines the required working duration assigned to an employee. It does not define mandatory check-in or checkout clock times. The company uses duration as the work requirement rather than a fixed shift start/end time.

`WorkSchedule.requiredWorkMinutes` is authoritative for new attendance requirements and is snapshotted into `Attendance.requiredWorkMinutes` at regular check-in. Historical attendance must continue to use the attendance snapshot rather than the employee's current WorkSchedule.

Do not model or infer late arrival, early checkout, or shift-time violations unless a future requirement explicitly introduces fixed working hours. A user may legitimately check in at 11:00 and check out at 19:00 when the required duration is 480 minutes.

Overtime duration remains separate from regular work duration.

Do not automatically use overtime to compensate for insufficient regular duration unless explicitly introduced as a future business rule.

---

# 13. Overtime Authorization

Overtime is not automatically available.

Before a user can perform overtime:

1. Regular attendance must exist.
2. Regular attendance must be checked out/completed.
3. Admin must grant overtime authorization for the relevant user/work date.
4. Authorization must still be valid/not revoked.

Authorization and actual overtime activity are separate domain concepts.

Example:

```text
OvertimeAuthorization
        ↓
permission to perform overtime

Overtime
        ↓
actual overtime activity
```

Granting authorization must not automatically create completed overtime attendance.

---

# 14. Overtime Attendance

Overtime contains separate check-in and checkout events.

## Overtime Check-In requires:

* Completed regular attendance
* Valid overtime authorization
* GPS
* Event timezone
* Photo
* Description
* Server timestamp

## Overtime Checkout requires:

* Existing open overtime
* GPS
* Event timezone
* Photo
* Description
* Server timestamp

Overtime description is mandatory for both check-in and checkout.

Overtime photo is mandatory for both check-in and checkout.

---

# 15. Photo Evidence

Overtime check-in and checkout require camera/photo evidence.

The system should optimize images before permanent storage.

Recommended processing target:

```text
Maximum input size      reasonable upload limit, e.g. 10 MB
Maximum image dimension approximately 1600 px
Preferred output target <= 1 MB
Hard output limit       <= 2 MB
Original retained       no, unless requirement changes
```

Do not rely solely on the client to compress or validate images.

Server-side processing remains authoritative.

Typical pipeline:

```text
Upload
  ↓
Validate MIME / image
  ↓
Normalize orientation
  ↓
Resize
  ↓
Add evidence watermark
  ↓
Compress
  ↓
Validate final size
  ↓
Store
```

---

# 16. Photo Watermark

Stored overtime evidence photos should contain a visual watermark.

Watermark may include:

* Event type
* Local event date/time
* Timezone abbreviation/identifier
* Location/address when available
* Latitude/longitude
* GPS accuracy

Example:

```text
OVERTIME CHECK IN
17 Sep 2026 • 18:07 WITA
Makassar, Sulawesi Selatan
-5.1477, 119.4327 • ±9m
```

The watermark is NOT the source of truth.

Structured metadata must still be stored in the database.

Do not use the device clock as the authoritative watermark timestamp.

Generate displayed local event time from:

```text
server timestamp + event timezone
```

User-entered descriptions do not need to be embedded into the photo.

---

# 17. File Storage

Initial deployment may use local hosting storage.

Do not tightly couple overtime business logic to local filesystem operations.

Use a storage abstraction so the provider can later change to:

* S3
* Cloudflare R2
* MinIO
* another object storage provider

Conceptually:

```ts
interface StorageService {
  upload(...)
  delete(...)
  getUrl(...)
}
```

Database records should store a relative storage key/path or provider object key rather than a machine-specific absolute filesystem path.

Use generated safe filenames such as UUID-based names.

Never trust user-provided filenames for filesystem paths.

---

# 18. Admin Time Display

Admin attendance monitoring should primarily show the local event time experienced by the worker.

Example:

```text
Budi
08:03 WIB

Andi
08:01 WITA

Siti
08:05 WIT
```

When useful, WIB (`Asia/Jakarta`) may be shown as an administrative reference time in detail/reporting views.

Do not permanently convert stored timestamps to WIB.

UTC remains the timestamp source of truth.

Timezone-aware formatting happens at presentation/reporting boundaries.

---

# 19. Admin Monitoring

Admin interfaces should support monitoring of:

* User
* Work date
* Regular check-in
* Regular checkout
* Event timezone
* Location
* Daily report
* Actual work duration
* Required duration
* Duration difference
* Overtime authorization
* Overtime check-in
* Overtime checkout
* Overtime duration
* Overtime descriptions
* Overtime photos

Use pagination/filtering for potentially large datasets.

Do not load unlimited attendance history into a single request.

---

# 20. Reporting and Export

Reporting must support filters.

Expected filters may include:

* Date range
* User
* Attendance state/status
* Overtime state/status

Exports should be based on the active filters.

Reports may contain:

```text
Employee
Work Date

Regular Check In
Regular Check In Timezone
Regular Check In Location

Regular Check Out
Regular Check Out Timezone
Regular Check Out Location

Regular Duration
Required Duration
Difference

Daily Report

Overtime Authorized

Overtime Check In
Overtime Check In Timezone
Overtime Check In Location
Overtime Check In Description

Overtime Check Out
Overtime Check Out Timezone
Overtime Check Out Location
Overtime Check Out Description

Overtime Duration
```

Photo evidence should generally be represented by a reference/link/path rather than embedding raw image binary into tabular exports.

---

# 21. Audit Trail

Important administrative actions should be auditable.

Examples:

* User created
* User updated
* User activated
* User deactivated
* Overtime authorization granted
* Overtime authorization revoked
* Future attendance corrections, if introduced

Audit records should capture enough information to determine:

```text
who
did what
to which entity
when
relevant metadata
```

Do not make audit logging dependent on UI behavior.

---

# 22. Mobile-First User Experience

The USER side is primarily used on smartphones.

Priorities:

* Large touch targets
* Clear attendance state
* Minimal steps
* Clear GPS state
* Clear camera state
* Clear success/error feedback
* Avoid desktop-style dense tables
* Avoid unnecessary modals
* Avoid horizontal scrolling for primary workflows

Suggested user navigation:

```text
Home
Attendance
Overtime
```

A mobile bottom navigation is preferred when appropriate.

The current attendance state should be immediately understandable after login.

The USER Home should provide a concise daily attendance summary containing employee identity, company position when available, and the applicable regular attendance check-in/check-out state and event-local times. If an open regular Attendance exists from a previous `workDate`, Home should show that active Attendance rather than incorrectly presenting the user as not checked in. Otherwise, Home may resolve attendance for the current business date using the established attendance/date-time rules.

USER-facing Home/profile summaries must not present the system role (`USER`) as a company position and should not expose required work minutes/hours as a worker-facing requirement summary. Required duration remains available to ADMIN/system monitoring and reporting.

Home may navigate the user to the Attendance workflow but must not duplicate the authoritative check-in/check-out mutations.

---

# 23. Admin Experience

Admin screens may use:

* Sidebar navigation
* Tables
* Filters
* Date ranges
* Pagination
* Detail panels/pages
* Desktop-oriented information density

Admin UI must still remain responsive.

Do not reuse a desktop admin table as the primary mobile USER attendance interface.

---

# 24. Security Principles

Always assume client input can be manipulated.

Therefore:

* Authenticate on the server
* Authorize on the server
* Validate input on the server
* Generate official timestamps on the server
* Enforce attendance state transitions in services
* Validate uploaded files
* Generate safe storage paths
* Never expose internal filesystem paths
* Never expose raw database errors
* Never trust disabled UI buttons as enforcement
* Never trust user IDs supplied by normal USER operations when identity can be derived from the authenticated session

Sensitive operations must derive the acting user from the authenticated session.

---

# 25. Concurrency and Duplicate Submission

Attendance actions must be designed for duplicate clicks, retries, and concurrent requests.

Examples to prevent:

```text
CHECK IN
CHECK IN
```

creating two open attendances.

Or:

```text
OVERTIME CHECK OUT
OVERTIME CHECK OUT
```

performing duplicate mutations.

Use:

* Database unique constraints
* Transactions where appropriate
* Service-level state checks
* Idempotent patterns where practical
* Disabled/loading UI only as additional UX protection

Database constraints and server rules are authoritative.

---

# 26. Error Handling

Use predictable application/domain errors.

Differentiate where useful between:

* Validation errors
* Authentication errors
* Authorization errors
* Not-found errors
* Invalid domain state
* Infrastructure/storage errors

UI-facing messages should be understandable.

Do not expose stack traces, SQL messages, Prisma internals, storage credentials, or filesystem details to end users.

---

# 27. Data Mapping

Do not expose Prisma models blindly to Client Components.

Use DTOs/mappers when:

* Decimal serialization is involved
* Date formatting/serialization is required
* Sensitive fields must be removed
* Derived values are needed
* UI requires a stable contract independent of persistence structure

Examples of derived fields:

```text
durationMinutes
durationFormatted
requiredMinutes
differenceMinutes
localCheckInTime
localCheckOutTime
```

Keep calculations centralized rather than duplicating them across pages.

---

# 28. Naming Conventions

Prefer descriptive domain naming.

Examples:

```text
attendance.service.ts
attendance.repository.ts
attendance.schema.ts

overtime.service.ts
overtime.repository.ts

overtime-authorization.repository.ts
```

Functions should describe intent:

```text
checkIn
checkOut
saveDailyReport
grantOvertimeAuthorization
revokeOvertimeAuthorization
getOpenAttendance
```

Avoid vague names:

```text
handleData
processThing
doAction
helper2
```

---

# 29. Code Quality Rules

Before completing a task:

* Review existing implementation first
* Reuse existing abstractions
* Avoid duplicated utilities
* Avoid duplicated business rules
* Keep functions focused
* Preserve strict typing
* Remove unused imports
* Remove dead code introduced during implementation
* Do not leave unexplained TODO placeholders
* Do not introduce dependencies without a concrete need

Prefer straightforward code over unnecessary abstraction.

Do not over-engineer speculative future requirements.

---

# 30. Codex Working Rules

When implementing a requested phase:

1. Read this `AGENTS.md`.
2. Inspect only the relevant existing files/directories before implementation.
3. Reuse established project patterns.
4. Do not repeatedly analyze the entire repository when the relevant architecture is already documented here.
5. Do not redesign established architecture unless the requested phase requires it.
6. Do not implement future phases prematurely.
7. Make the smallest coherent set of changes required for the current phase.
8. Keep existing working functionality intact.
9. Run relevant validation after implementation.
10. Summarize what changed and identify any important assumptions.

Before creating a new abstraction, search for an existing equivalent.

Do not create parallel implementations of:

* authentication
* authorization
* action result types
* date/time utilities
* storage services
* repositories
* domain services
* error classes

Extend existing implementations when appropriate.

---

# 31. Validation Before Phase Completion

As applicable, verify:

```bash
npm run lint
```

Run TypeScript checking when configured.

Run:

```bash
npm run build
```

when appropriate for the phase.

For database-related phases:

* Verify Prisma schema
* Verify Prisma generation
* Verify migrations where applicable

Do not report a phase as complete when known compile/type/lint errors introduced by the phase remain unresolved.

---

# 32. Development Phases

ETime development is divided into 12 phases.

## Phase 1 — Project Foundation & Architecture

Establish:

* Dependencies
* shadcn/ui
* Prisma/MariaDB
* Zod
* Project structure
* Shared configuration
* Base utilities
* Architecture conventions

Do not implement complete business domains prematurely.

## Phase 2 — Database Foundation & User Domain

Implement:

* Core Prisma models
* User
* Role
* Work schedule / required duration (duration-based; no fixed start/end requirement)
* Audit foundation
* User repository/service/schema/actions
* Initial admin seed

## Phase 3 — Authentication & Authorization

Implement:

* Login
* Logout
* Session
* Route protection
* Role authorization
* Inactive-user handling
* ADMIN/USER redirects

## Phase 4 — Application Shell & User Mobile UI

Implement:

* User layout
* Admin layout
* Navigation
* User home
* Profile summary including employee position when available
* Mobile-first shell
* Admin shell

## Phase 5 — Regular Attendance

Implement:

* GPS acquisition
* Device timezone
* Regular check-in
* Open attendance handling
* Work date
* Attendance state

## Phase 6 — Daily Report & Regular Checkout

Implement:

* Daily report
* Daily report requirement
* Regular checkout
* Work duration calculation

## Phase 7 — Admin Attendance Monitoring

Implement:

* Attendance table
* Filters
* Pagination
* Attendance details
* Local event times
* Duration monitoring
* Required vs actual duration

## Phase 8 — Overtime Authorization

Implement:

* Grant authorization
* Revoke authorization
* Work-date authorization
* Audit trail
* User overtime availability rules

## Phase 9 — Overtime Attendance & Photo Pipeline

Implement:

* Overtime check-in
* Overtime checkout
* GPS
* Timezone
* Camera/photo
* Required descriptions
* Image optimization
* Watermark
* Storage abstraction

## Phase 10 — Admin Overtime Monitoring

Implement:

* Overtime monitoring
* Filters
* Detail view
* Evidence photos
* Locations
* Descriptions
* Duration

## Phase 11 — Reporting & Export

Implement:

* Reporting filters
* Attendance reporting
* Overtime reporting
* Daily report inclusion
* Export
* Timezone-aware output

## Phase 12 — Hardening & Final Integration

Review and harden:

* Authentication
* Authorization
* Validation
* Race conditions
* Duplicate submissions
* Timezone edge cases
* Upload security
* Error handling
* Mobile UX
* Admin UX
* Performance
* Type safety
* Lint
* Build
* Architecture consistency

Do not implement a later phase unless explicitly requested.

---

# 33. Core Domain Invariants

These rules must remain true unless requirements are explicitly changed:

```text
1. Official timestamps come from the server.

2. GPS is mandatory for every regular and overtime
   check-in/check-out event.

3. Regular check-in description is optional.

4. Regular checkout description is optional.

5. Daily report is mandatory before regular checkout.

6. Regular duration =
   regularCheckOutAt - regularCheckInAt.

7. Breaks are not deducted.

8. Overtime requires completed regular attendance.

9. Overtime requires admin authorization.

10. Overtime check-in requires:
    GPS + timezone + photo + description.

11. Overtime checkout requires:
    GPS + timezone + photo + description.

12. Overtime duration =
    overtimeCheckOutAt - overtimeCheckInAt.

13. Regular and overtime durations remain separate.

14. Timezone is captured per event.

15. Check-in and checkout may have different timezones.

16. workDate is established at regular check-in
    and remains stable.

17. Database timestamps remain absolute/UTC-based.

18. Local time formatting is a presentation concern.

19. Photo watermark is evidence presentation,
    not the authoritative metadata source.

20. Authorization and business rules are enforced
    server-side.

21. `ADMIN` / `USER` are system authorization roles;
    employee company position is separate and nullable.

22. WorkSchedule defines required work duration, not
    mandatory start/end clock times.

23. `Attendance.requiredWorkMinutes` is the historical
    snapshot used for required-duration comparisons.

24. Valid attendance is not classified as late/early
    from check-in or checkout clock time.

25. GPS coordinates/accuracy remain authoritative
    location evidence; reverse-geocoded address is a
    server-derived nullable event snapshot.

26. Reverse-geocoding failure alone must not block an
    attendance event when required GPS evidence is valid.

27. USER Home shows applicable regular attendance state
    and event-local check-in/check-out times without
    exposing required work duration as worker-facing info.
```

---

# 34. Guiding Principle

When uncertain where code belongs, use this rule:

```text
Is it UI behavior?
→ component/page

Is it input validation?
→ Zod schema

Is it request/session boundary logic?
→ Server Action

Is it a business decision or domain rule?
→ Service

Is it database access?
→ Repository

Is it persistence mapping?
→ Mapper/Repository

Is it shared infrastructure?
→ lib/
```

Keep ETime predictable.

Consistency and maintainability are more important than cleverness.
