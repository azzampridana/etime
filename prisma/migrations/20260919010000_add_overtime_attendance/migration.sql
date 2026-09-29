-- CreateTable
CREATE TABLE `Overtime` (
    `id` CHAR(36) NOT NULL,
    `authorizationId` CHAR(36) NOT NULL,
    `checkInAt` DATETIME(3) NOT NULL,
    `checkInLatitude` DOUBLE NOT NULL,
    `checkInLongitude` DOUBLE NOT NULL,
    `checkInAccuracy` DOUBLE NOT NULL,
    `checkInAddress` VARCHAR(500) NULL,
    `checkInTimezone` VARCHAR(100) NOT NULL,
    `checkInDescription` VARCHAR(1000) NOT NULL,
    `checkInPhotoPath` VARCHAR(500) NOT NULL,
    `checkOutAt` DATETIME(3) NULL,
    `checkOutLatitude` DOUBLE NULL,
    `checkOutLongitude` DOUBLE NULL,
    `checkOutAccuracy` DOUBLE NULL,
    `checkOutAddress` VARCHAR(500) NULL,
    `checkOutTimezone` VARCHAR(100) NULL,
    `checkOutDescription` VARCHAR(1000) NULL,
    `checkOutPhotoPath` VARCHAR(500) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Overtime_authorizationId_key`(`authorizationId`),
    INDEX `Overtime_checkOutAt_idx`(`checkOutAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Overtime` ADD CONSTRAINT `Overtime_authorizationId_fkey` FOREIGN KEY (`authorizationId`) REFERENCES `OvertimeAuthorization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
