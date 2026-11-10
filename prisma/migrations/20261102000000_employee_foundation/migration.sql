-- E1 source only. Verify target, backup, user.id collation and pause writers first.
-- UUID and updatedAt are Prisma-managed for future application writes.
CREATE TABLE `employee` (
    `id` CHAR(36) NOT NULL,
    `userId` CHAR(36) NULL,
    `employeeNumber` VARCHAR(50) NULL,
    `fullName` VARCHAR(100) NOT NULL,
    `jobTitle` VARCHAR(100) NULL,
    `joinDate` DATE NULL,
    `employmentStatus` ENUM('ACTIVE', 'INACTIVE', 'RESIGNED', 'TERMINATED') NOT NULL DEFAULT 'ACTIVE',
    `employmentEndDate` DATE NULL,
    `phoneNumber` VARCHAR(50) NULL,
    `address` TEXT NULL,
    `nik` VARCHAR(32) NULL,
    `bankName` VARCHAR(100) NULL,
    `bankAccountNumber` VARCHAR(100) NULL,
    `bankAccountHolder` VARCHAR(100) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `version` INTEGER NOT NULL DEFAULT 1,

    UNIQUE INDEX `employee_userId_key` (`userId`),
    UNIQUE INDEX `employee_employeeNumber_key` (`employeeNumber`),
    INDEX `employee_employmentStatus_fullName_id_idx` (`employmentStatus`, `fullName`, `id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `employee` ADD CONSTRAINT `employee_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `user` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- One-time initial employment status for this approved backfill cohort only.
-- This is not a synchronization rule between employmentStatus and user.isActive.
-- Repeat-safe data step: never overwrite an existing profile or link ADMINs.
INSERT INTO `employee` (
    `id`, `userId`, `fullName`, `jobTitle`, `employmentStatus`, `createdAt`, `updatedAt`, `version`
)
SELECT UUID(), u.`id`, u.`name`, NULLIF(TRIM(u.`position`), ''), 'ACTIVE',
       CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3), 1
FROM `user` u
WHERE u.`role` = 'USER' AND u.`isActive` = TRUE
  AND NOT EXISTS (SELECT 1 FROM `employee` e WHERE e.`userId` = u.`id`);
