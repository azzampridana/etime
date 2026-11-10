# P4.1 — Publish and detail modal close

Source/diff review only; no tests, compilation, browser, Prisma or DB commands.
Existing Payslip publishedAt/publishedById/status/version fields suffice: no schema
or migration changes. No PDF or USER access.

POST `/api/admin/payroll/[id]/publish` accepts strict `{version}` only and returns
the published detail DTO through the existing private/no-store API envelope.
Authorization, JSON/same-origin checks and sanitized 400/401/403/404/409/500 handling
reuse the existing API helper. publishedById is read internally for consistency,
not added to the public DTO.

Transaction: active ADMIN actor lock/recheck -> Payslip lock -> DRAFT/version check
-> validate persisted period, optional bank/account and items using current rules
-> recalculate Decimal totals and compare exactly -> conditional publish update
-> PAYROLL_PUBLISHED audit -> return authoritative detail. Server sets publishedAt,
publishedById, updatedById and increments version. No item, total, bank or snapshot
is changed. Audit contains version metadata only. Failure rolls back both changes.
Save/Delete use the same parent lock and DRAFT/version conditions; competing Save
or Publish cannot silently overwrite. Initialization skips any existing status.

Zero amounts and optional bank/account remain valid. Existing empty-item draft
rules remain unchanged; no new minimum value or item-count minimum is introduced.
Invalid item shape/order/origin, negative THP, inconsistent stored totals or residual
publication metadata on a draft are rejected, never silently repaired on publish.

UI Publish requires a saved, unchanged draft and explicit finality confirmation.
Busy ref/pending state prevent double submission and concurrent local save/publish.
409 and unknown outcomes block further mutation until explicit reload. Success
switches modal to PUBLISHED using response data, then refreshes the list; failed
list refresh is reported as refresh failure, not failed publication.

Single header X (aria-label Tutup) replaces footer close controls. X, Escape and
pointer backdrop invoke the same form close guard, which rejects closure while
busy and confirms unsaved changes. Radix traps focus and restores the opener.
Loading/error/PUBLISHED states close directly. No primitive-provided duplicate X.
Legacy edit page uses the same Publish implementation and retains its page Back
navigation. Legacy detail remains a page rather than a separate modal.

Manual acceptance:
- Anonymous/USER/inactive/demoted ADMIN and malformed/extra payload fields.
- Zero-value, optional-bank and valid MASTER/CUSTOM drafts publish unchanged.
- Invalid stored items/totals are rejected without any changes.
- Audit failure rollback; server publication timestamp/actor and version increment.
- Save vs Publish, Publish vs Publish and stale version return safe conflicts.
- Published PUT/Delete blocked and initialization leaves published slips untouched.
- Dirty form disables Publish; save then reopen permits Publish confirmation.
- Success shows PUBLISHED, Save inactive, PDF disabled; refresh failure is explicit.
- X/Escape/backdrop dirty-confirm and busy blocking on mobile/desktop, keyboard
  navigation/focus return; no footer close duplication.
- Network/commit ambiguity requires reloading authoritative data before retry.

P4.2 can build on the publication state after manual verification; PDF is not
implemented or runtime-verified here.
