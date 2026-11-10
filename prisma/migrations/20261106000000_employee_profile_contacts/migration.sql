-- Additive E3 migration. Review target, backup and partial artifacts before deployment.
ALTER TABLE `employee`
    ADD COLUMN `npwp` VARCHAR(32) NULL,
    ADD COLUMN `placeOfBirth` VARCHAR(100) NULL,
    ADD COLUMN `dateOfBirth` DATE NULL,
    ADD COLUMN `gender` ENUM('MALE', 'FEMALE', 'OTHER') NULL,
    ADD COLUMN `maritalStatus` ENUM('SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED') NULL,
    ADD COLUMN `bpjsKesehatanNumber` VARCHAR(50) NULL,
    ADD COLUMN `bpjsKetenagakerjaanNumber` VARCHAR(50) NULL,
    ADD COLUMN `employmentType` ENUM('PERMANENT', 'CONTRACT', 'PROBATION', 'INTERN', 'FREELANCE') NULL;

CREATE TABLE `employee_family_contact` (
    `id` CHAR(36) NOT NULL,
    `employeeId` CHAR(36) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `relationship` VARCHAR(50) NOT NULL,
    `phoneNumber` VARCHAR(50) NOT NULL,
    `address` TEXT NULL,
    `isEmergencyContact` BOOLEAN NOT NULL DEFAULT false,
    `isPrimary` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY (`id`),
    INDEX `employee_family_contact_employeeId_idx` (`employeeId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `employee_family_contact` ADD CONSTRAINT `employee_family_contact_employeeId_fkey`
    FOREIGN KEY (`employeeId`) REFERENCES `employee` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
