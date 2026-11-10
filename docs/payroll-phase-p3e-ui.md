# P3E — Period workspace and modal

Source-only implementation/review. No compilation, browser, database or production
verification was run. Backend, schema, migrations and USER navigation are unchanged.

Workspace defaults to the current Jakarta month/year; explicit existing query
filters still work. Apply selectors before generation; generation always confirms
the displayed active period. Name search filters only the loaded page (explicit UI
label), never claims whole-dataset search. Existing server pagination is retained.

Initialization uses the existing endpoint and checks status/remainingEmployeesProcessed
and unconfirmedCount. Displays created, skippedExisting, skippedIneligible, failed
and unconfirmed counts. Stopped/unknown results require refresh plus operator
reconciliation confirmation before retry. No automatic retry. Refresh failure after
a mutation is not presented as mutation failure. Locks prevent double-clicks in
the mounted UI; reload/navigation can lose client state, so operators must reconcile
after interrupted requests. Backend idempotency remains authoritative.

Draft clicks load latest detail into a Radix modal. Mobile is full-screen; desktop
is width-bounded with internal scrolling and sticky actions. Focus trapping and
return-to-opener are provided; Escape/outside clicks deliberately do not discard
forms. Use the keyboard-accessible Tutup button, with unsaved confirmation. Existing
form browser unload/back guard is retained; browser history jumps/OS termination
cannot be guaranteed. No localStorage or sensitive console logging.

PUT includes all items, string amounts, bank/account and original version. BigInt
preview and P3A schemas remain. 409 blocks save until explicit reload. PUBLISHED
modal is read-only. Publish and Download PDF are disabled upcoming features.

## Deliberate metadata limitation

PayslipItem has no master/custom provenance. No name matching is used. All persisted
items have protected name/order/removal in the shared editor; only their amounts
can change. New unsaved custom items can be named/reordered/removed, then become
protected after save/reopen. Category is selected by the add-section; to change it
for an unsaved item, remove and re-add in the other section. This conservative UI
cannot support renaming/deleting saved custom items until a reliable backend
metadata contract is separately designed. Server contracts are not tightened here.

`/admin/payroll/components` is ADMIN-guarded and uses existing paginated master APIs.
Create and full PUT update support name/category/order/isActive/version, including
reactivation. Deactivation uses the supported isActive=false PUT with confirmation.
Changes only affect future initialization; duplicate-name/version conflicts block
editing until reload. No hard delete or new endpoint.

Legacy new/edit/detail routes remain accessible; none deleted. Shared editor safety
also applies to legacy edit. Legacy detail retains authorized delete functionality.

## Manual checklist

- Period defaults, apply/reset, pagination and page-only search.
- Generate confirmation, rapid double click, zero/over-100 master rejection,
  completed/stopped/unconfirmed reports and refresh failure/reconciliation flow.
- DRAFT modal amount entry (zero/18-digit/negative THP), all-item PUT, bank leading
  zeroes, additional items, frozen existing items, 100-item limit, stale 409.
- Success closes modal and refreshes list; failed refresh preserves success feedback.
- PUBLISHED cannot save; Publish/PDF disabled; legacy routes still work.
- Master create, rename/category/order, deactivate/reactivate, duplicates and stale
  version; cancel/leave with unsaved changes.
- Mobile keyboard/viewport/scroll/footer, desktop focus trap/return, dark mode,
  long text and exact IDR formatting. Check browser Back and interrupted requests.
- Anonymous/USER/inactive/demoted ADMIN protections through existing server guards.

Stop at P3E; no Publish/PDF or USER payslip implementation.
