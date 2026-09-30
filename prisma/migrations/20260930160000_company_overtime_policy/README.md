# Deployment: company overtime policy

This migration targets the existing lowercase physical MySQL tables. It adds
`overtime.maxOpenMinutes NOT NULL DEFAULT 720`, initializing existing rows to
their historical 12-hour window without changing checkout or other evidence.
It creates `overtimepolicy` and seeds the company row (id 1) with 720 minutes.
The SQL/Prisma defaults are the migration-time equivalent of the application
`DEFAULT_OVERTIME_MAX_OPEN_MINUTES`; session state never reads the live policy.

Back up the database and deploy this migration before enabling the new code.
During your deployment, run the normal `prisma migrate deploy` and
`prisma generate` steps, then build/restart the application. These steps were
not run while preparing this source change. MySQL DDL may take a table lock;
schedule the migration appropriately for the size of the overtime table.

The application requires the migrated schema and regenerated Prisma client.
There is no catch-and-ignore fallback for a missing table or missing column.
The application default handles a missing singleton row only. All application
policy writes target id 1; callers cannot supply a different policy id.

Manual acceptance: start OT under 720 minutes, change the company policy to 600,
confirm that the existing record still has 720 and a new authorized session has
600. Check each session at its exact boundary and just beyond it, including
cross-midnight sessions, revoked authorizations, and mixed-window historical
records. Policy updates must create AuditLog entries with actor and before/after
minutes. Missing checkout must continue to yield no credited overtime duration.
