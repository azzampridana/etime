-- Source-only foundation. Run only after target, backup and compatibility preflight.
CREATE TABLE `overtimecorrectionrequest` (
  `id` CHAR(36) NOT NULL,
  `overtimeId` CHAR(36) NOT NULL,
  `userId` CHAR(36) NOT NULL,
  `status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
  `reason` VARCHAR(2000) NOT NULL,
  `proposedCheckOutAt` DATETIME(3) NOT NULL,
  `originalOvertimeSnapshot` JSON NOT NULL,
  `pendingSlot` TINYINT UNSIGNED NULL DEFAULT 1,
  `reviewedById` CHAR(36) NULL,
  `reviewedAt` DATETIME(3) NULL,
  `reviewNote` VARCHAR(2000) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `ot_correction_pending_key` (`overtimeId`, `pendingSlot`),
  INDEX `ot_correction_status_created_idx` (`status`, `createdAt`, `id`),
  INDEX `ot_correction_user_created_idx` (`userId`, `createdAt`, `id`),
  INDEX `ot_correction_reviewer_idx` (`reviewedById`, `reviewedAt`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `overtime`
  ADD COLUMN `checkOutSource` ENUM('NORMAL', 'ADMIN_CORRECTION') NULL,
  ADD COLUMN `checkOutCorrectionRequestId` CHAR(36) NULL,
  ADD UNIQUE INDEX `overtime_checkout_correction_key` (`checkOutCorrectionRequestId`);

-- Only provenance changes. Missing Checkout remains NULL; timestamps are untouched.
UPDATE `overtime` SET `checkOutSource` = 'NORMAL' WHERE `checkOutAt` IS NOT NULL;

-- Both sides exist before adding reciprocal references.
ALTER TABLE `overtimecorrectionrequest`
  ADD CONSTRAINT `overtimecorrectionrequest_overtimeId_fkey` FOREIGN KEY (`overtimeId`) REFERENCES `overtime` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT `overtimecorrectionrequest_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `overtimecorrectionrequest_reviewedById_fkey` FOREIGN KEY (`reviewedById`) REFERENCES `user` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `overtime`
  ADD CONSTRAINT `overtime_checkOutCorrectionRequestId_fkey` FOREIGN KEY (`checkOutCorrectionRequestId`) REFERENCES `overtimecorrectionrequest` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;
