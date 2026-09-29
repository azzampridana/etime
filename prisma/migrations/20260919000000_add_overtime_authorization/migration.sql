-- CreateTable
CREATE TABLE `OvertimeAuthorization` (
    `id` CHAR(36) NOT NULL,
    `attendanceId` CHAR(36) NOT NULL,
    `grantedById` CHAR(36) NOT NULL,
    `grantedAt` DATETIME(3) NOT NULL,
    `revokedAt` DATETIME(3) NULL,
    `note` VARCHAR(1000) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `OvertimeAuthorization_attendanceId_key`(`attendanceId`),
    INDEX `OvertimeAuthorization_grantedById_idx`(`grantedById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `OvertimeAuthorization` ADD CONSTRAINT `OvertimeAuthorization_attendanceId_fkey` FOREIGN KEY (`attendanceId`) REFERENCES `Attendance`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OvertimeAuthorization` ADD CONSTRAINT `OvertimeAuthorization_grantedById_fkey` FOREIGN KEY (`grantedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
