-- Prepared for manual review; not executed by this task.
-- Confirm production MariaDB version, FK collations and nullable unique-key semantics
-- before deployment. All physical table names deliberately use lowercase.
CREATE TABLE `attendancecorrectionrequest` (
    `id` CHAR(36) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `attendanceId` CHAR(36) NULL,
    `workDate` DATE NOT NULL,
    `type` ENUM('MISSING_CHECKOUT', 'MISSING_BOTH') NOT NULL,
    `requestedCheckInAt` DATETIME(3) NULL,
    `requestedCheckOutAt` DATETIME(3) NOT NULL,
    `requestedCheckInTimezone` VARCHAR(100) NULL,
    `requestedCheckOutTimezone` VARCHAR(100) NOT NULL,
    `requiredWorkMinutes` SMALLINT UNSIGNED NULL,
    `snapshotBasis` ENUM('WORK_SCHEDULE_AT_SUBMISSION') NULL,
    `snapshotWorkScheduleId` CHAR(36) NULL,
    `snapshotWorkScheduleName` VARCHAR(100) NULL,
    `reason` VARCHAR(2000) NOT NULL,
    `proposedDailyReportContent` TEXT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `pendingSlot` TINYINT UNSIGNED NULL DEFAULT 1,
    `reviewedById` CHAR(36) NULL,
    `reviewedAt` DATETIME(3) NULL,
    `reviewNote` VARCHAR(2000) NULL,
    `originalAttendanceSnapshot` JSON NULL,
    `appliedApprovalSnapshot` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE INDEX `correction_pending_user_date_key` (`userId`, `workDate`, `pendingSlot`),
    INDEX `correction_status_created_idx` (`status`, `createdAt`, `id`),
    INDEX `correction_user_date_created_idx` (`userId`, `workDate`, `createdAt`),
    INDEX `correction_attendance_idx` (`attendanceId`),
    INDEX `correction_reviewer_date_idx` (`reviewedById`, `reviewedAt`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `attendance`
    MODIFY `checkInLatitude` DOUBLE NULL,
    MODIFY `checkInLongitude` DOUBLE NULL,
    MODIFY `checkInAccuracy` DOUBLE NULL,
    ADD COLUMN `checkInSource` ENUM('NORMAL', 'ADMIN_CORRECTION') NOT NULL DEFAULT 'NORMAL',
    ADD COLUMN `checkOutSource` ENUM('NORMAL', 'ADMIN_CORRECTION') NULL,
    ADD COLUMN `checkInCorrectionRequestId` CHAR(36) NULL,
    ADD COLUMN `checkOutCorrectionRequestId` CHAR(36) NULL,
    ADD INDEX `attendance_checkin_correction_idx` (`checkInCorrectionRequestId`),
    ADD INDEX `attendance_checkout_correction_idx` (`checkOutCorrectionRequestId`);

-- Preserve event timestamps, GPS, required minutes and updatedAt. Open rows stay NULL.
UPDATE `attendance` SET `checkOutSource` = 'NORMAL' WHERE `checkOutAt` IS NOT NULL;

ALTER TABLE `attendancecorrectionrequest`
    ADD CONSTRAINT `attendancecorrectionrequest_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT `attendancecorrectionrequest_attendanceId_fkey` FOREIGN KEY (`attendanceId`) REFERENCES `attendance` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
    ADD CONSTRAINT `attendancecorrectionrequest_reviewedById_fkey` FOREIGN KEY (`reviewedById`) REFERENCES `user` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `attendance`
    ADD CONSTRAINT `attendance_checkInCorrectionRequestId_fkey` FOREIGN KEY (`checkInCorrectionRequestId`) REFERENCES `attendancecorrectionrequest` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
    ADD CONSTRAINT `attendance_checkOutCorrectionRequestId_fkey` FOREIGN KEY (`checkOutCorrectionRequestId`) REFERENCES `attendancecorrectionrequest` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;
