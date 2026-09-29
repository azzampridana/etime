-- CreateTable
CREATE TABLE `Attendance` (
    `id` CHAR(36) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `workDate` DATE NOT NULL,
    `requiredWorkMinutes` SMALLINT UNSIGNED NOT NULL,
    `checkInAt` DATETIME(3) NOT NULL,
    `checkInLatitude` DOUBLE NOT NULL,
    `checkInLongitude` DOUBLE NOT NULL,
    `checkInAccuracy` DOUBLE NOT NULL,
    `checkInAddress` VARCHAR(500) NULL,
    `checkInTimezone` VARCHAR(100) NOT NULL,
    `checkInDescription` VARCHAR(1000) NULL,
    `checkOutAt` DATETIME(3) NULL,
    `checkOutLatitude` DOUBLE NULL,
    `checkOutLongitude` DOUBLE NULL,
    `checkOutAccuracy` DOUBLE NULL,
    `checkOutAddress` VARCHAR(500) NULL,
    `checkOutTimezone` VARCHAR(100) NULL,
    `checkOutDescription` VARCHAR(1000) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Attendance_userId_checkOutAt_idx`(`userId`, `checkOutAt`),
    UNIQUE INDEX `Attendance_userId_workDate_key`(`userId`, `workDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Attendance` ADD CONSTRAINT `Attendance_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
