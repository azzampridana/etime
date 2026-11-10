# P3F.2 — Origin-aware Payroll editor

Operator reports local origin migration applied, Client 7.8.0 generated and 13
migrations up to date. Static generated-source inspection confirms PayslipItemOrigin
and required PayslipItem.origin. No CLI/database/runtime verification performed.

Shared draft form now retains DTO id/origin and a stable UI key. Existing keys
use their unchanged IDs; new CUSTOM items get local keys only, never database IDs.
PUT explicitly projects id (existing only), name, category, string amount and
sortOrder. Origin/UI keys are not sent. Version, bank/account and all retained
items remain in the payload. New manual POST items likewise omit id/origin.

MASTER controls permit amount only, including zero; no delete/reorder/category
control. CUSTOM (including legacy backfill) can be renamed, recategorized and
deleted. Category changes and additions allocate the first unused nonnegative
order in the destination category, including MASTER slots in the occupied set.
No existing MASTER order is changed. No master synchronization or name matching.
Index is used only for Zod error paths, not row identity or mutation targeting.

Existing BigInt preview, 100-item limit, negative THP rejection, 409 save blocking,
explicit reload and authoritative refresh after successful save are retained.
Dirty comparison includes items, names/categories/amounts, additions/deletions and
bank/account. Closing with edits requires confirmation. PUBLISHED continues to
render in the existing read-only branch. The prior P3E limitation protecting all
saved custom items and P3F.1's ID-less UI incompatibility are superseded here.

Manual checklist (not executed):
- MASTER amount change/zero survives save with unchanged IDs/name/category/order.
- Existing/backfilled CUSTOM rename/category change/removal preserves retained IDs.
- Add multiple new CUSTOM rows, delete a middle row, then edit remaining rows.
- Move CUSTOM into a category with occupied MASTER orders; verify unique order.
- Verify PUT has no origin/UI key and new rows have no ID; bank leading zeroes stay.
- Check 18-digit amounts, negative THP, 100 items and stale-version 409/reload.
- Confirm dirty-close behavior for every editable field and add/remove operation.
- Reopen after save; list refresh, correct origin, and PUBLISHED read-only behavior.
- Check mobile layout and focus after moving an item between category sections.

No backend/schema/migration changes. Compilation/runtime remain unverified;
browser Back/history jumps and OS termination retain existing browser limitations.
