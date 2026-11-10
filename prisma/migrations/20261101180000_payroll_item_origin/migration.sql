-- Pause application writers before execution. Legacy item lineage is unproven.
-- Temporary default backfills all existing rows without guessing from master names.
ALTER TABLE `payslipitem`
    ADD COLUMN `origin` ENUM('MASTER', 'CUSTOM') NOT NULL DEFAULT 'CUSTOM';
-- All new writers must specify origin explicitly; no lasting database default.
ALTER TABLE `payslipitem` ALTER COLUMN `origin` DROP DEFAULT;
