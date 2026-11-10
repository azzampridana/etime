# Payroll P3B — ADMIN UI

Source implementation and static review only. Compilation, browser behavior and
database integration have not been verified in this phase.

## Routes and integration

- `/admin/payroll`: year/month/status filters, server-paginated API results.
- `/admin/payroll/new`: active USER picker, draft creation.
- `/admin/payroll/[id]`: stored employee/company snapshots and financial detail,
  DRAFT edit/delete controls; PUBLISHED is read-only.
- `/admin/payroll/[id]/edit`: complete editable replacement with original version.

Each page uses the existing server ADMIN page guard. Reads and mutations use the
existing ADMIN Payroll API with `cache: no-store`. API/service authorization and
transactional rules are unchanged. The employee picker uses `listUsersAction`
with role USER, isActive true, search and ten results per page. No new endpoint.
The Payroll list does not offer name search because its backend only supports an
exact userId filter, not employee text search. No client-side history filtering.

PUT sends all editable items plus bankName/accountNumber and loaded version;
it never sends recipient, period, snapshots, status or computed totals. Money
remains strings; preview uses BigInt, with 18-digit totals and nonnegative THP.
Shared P3A Zod schemas provide field-level client feedback; server validation
remains authoritative. Item order is explicitly editable and unique by category.

409 responses block further submission until an explicit reload. Network/500
outcomes also block retries and instruct checking authoritative state. Delete
fetches the latest detail and rejects a changed version instead of silently
deleting unseen changes. No financial payloads are logged or stored locally.

## Manual acceptance checklist

- Verify anonymous, USER, inactive and demoted ADMIN cannot read or mutate Payroll.
- Exercise list filters, empty results, pagination, loading/error/reload states.
- Create a draft using an active USER selected through search/pagination.
- Check arbitrary earnings/deduction names, add/remove, duplicate order, 100-item
  limit, whole-rupiah validation, 18-digit totals and negative THP rejection.
- Compare amounts above Number.MAX_SAFE_INTEGER with server-returned totals.
- Edit all fields and confirm bank/account leading zeroes and untouched items
  survive PUT; employee/period/company snapshots remain immutable.
- In two tabs, change the same draft; confirm stale edit/delete receives 409 and
  cannot automatically overwrite. Check duplicate employee/period creation.
- Confirm PUBLISHED has no edit/delete controls, including a direct edit URL.
- Confirm delete dialog keyboard/focus behavior, cancellation and list refresh.
- Test uncertain network outcomes: inspect list/detail before retrying creation.
- Test dirty form Back, sidebar links, reload and browser close on desktop/mobile.
  The form adds a same-URL history guard for ordinary browser Back. Browser history
  jumps, suppressed beforeunload dialogs and mobile OS process termination cannot
  be guaranteed by a web UI; unsaved edits are deliberately not persisted locally.
- Check narrow mobile layouts, long names/accounts, 18-digit values, dark mode,
  visible focus, touch targets and screen-reader validation feedback.
- Verify same-origin API writes behind the real reverse proxy separately.

No Publish, PDF, USER payslip page, dependency, schema/migration, database operation,
or operational-domain change is included. P2/P3A working-tree changes are preserved.
