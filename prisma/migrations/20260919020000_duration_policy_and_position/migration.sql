-- Preserve all rows and historical Attendance.requiredWorkMinutes snapshots.
ALTER TABLE `User` ADD COLUMN `position` VARCHAR(100) NULL;
-- Approved removal of obsolete clock-time fields only.
ALTER TABLE `WorkSchedule` DROP COLUMN `startTime`, DROP COLUMN `endTime`;
