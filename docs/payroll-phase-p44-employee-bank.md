# P4.4 — Employee bank snapshots

Source/diff review only. No tests, build, Prisma or database commands run.

## Creation

Previously bulk initialization explicitly stored NULL bank/account; single creation used only form input. Both now look up Employee via the recipient's unique userId inside the existing transaction. The narrow locking lookup reads only bankName/bankAccountNumber. No name/email matching or employment-status eligibility changes.

Bulk copies the two strings (blank becomes NULL) and still skips every existing slip, including PUBLISHED. MASTER items retain zero initialization and no prior-period data is copied. Single creation fills blank fields from Employee while preserving explicit nonempty ADMIN form values for compatibility. Missing Employee/bank leaves fields NULL unless explicitly entered. Leading zeros are preserved. Subsequent editor reads are Payroll snapshots, not live Employee reads.

## Existing drafts

POST /api/admin/payroll/[id]/fill-bank accepts only `{ version, replaceExisting }`; no recipient, account or actor values accepted. Existing shared API enforces ADMIN, JSON, same-origin and private/no-store; service independently authenticates and rechecks active ADMIN under transaction lock.

Lock order is actor User, Payslip, Employee. Payslip must remain DRAFT at the supplied version; a conditional update increments version. Only bankName/accountNumber plus update metadata/version change. Items, totals, status, Publish and PDF remain untouched. Employee read uses FOR UPDATE for a current, consistent bank pair while competing profile edits wait. The lookup never exposes NIK, address, phone or holder.

Existing nonempty bank snapshots require explicit replaceExisting confirmation; UI asks before posting. Missing Employee or both fields empty returns a clear 400 without modifying the draft. Partial Employee banking copies the available field and preserves the saved value for the missing field, with a clear success notice. Audit PAYROLL_BANK_FILLED_FROM_EMPLOYEE is atomic and records changed field names/version, never raw bank/account values.

Fill is available only in saved DRAFT editors with no unsaved changes. Save local changes first. After successful fill, fields/version/dirty baseline update from the server result so subsequent Save/Publish uses the new version. Conflicts and unknown outcomes block retry until explicit reload. Data-entry fields remain editable. PUBLISHED UI has no Fill control and direct calls are rejected.

## Manual verification

- Create single/bulk drafts with Employee bank data, missing profile, partial data and account leading zeros. Check explicit single-create manual overrides.
- Verify existing bulk slips, MASTER zero amounts, recipient eligibility, item IDs and calculations remain unchanged.
- Fill a blank draft and a populated draft; cancel/accept confirmation; verify missing fields never erase existing snapshots. Missing/empty Employee must show clear feedback.
- Edit items/bank locally and verify Fill cannot discard unsaved edits. Fill then Save and Fill then Publish must use the returned version.
- Race Fill against Save/Publish/another Fill: one wins, stale request returns 409; no partial audit. Edit Employee concurrently and verify the snapshot represents one consistent read.
- Reject USER, inactive/demoted ADMIN, PUBLISHED slip and malformed payload. Check no-store and audit/log privacy.
- Verify PDF still reads stored Payslip bank values even after Employee data later changes.

No schema migration needed. Runtime behavior and compilation remain unverified.
