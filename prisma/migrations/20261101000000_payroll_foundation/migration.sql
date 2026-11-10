-- Manually prepared in P2.1; execution requires target/backup/compatibility preflight.
-- uuid() and @updatedAt are Prisma-managed, not database defaults.
CREATE TABLE `payslip` (
    `id` CHAR(36) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `year` INTEGER NOT NULL,
    `month` INTEGER NOT NULL,
    `status` ENUM('DRAFT', 'PUBLISHED') NOT NULL DEFAULT 'DRAFT',
    `employeeNameSnapshot` VARCHAR(100) NOT NULL,
    `employeePositionSnapshot` VARCHAR(100) NULL,
    `companyNameSnapshot` VARCHAR(200) NOT NULL,
    `companyAddressSnapshot` VARCHAR(500) NOT NULL,
    `companyEmailSnapshot` VARCHAR(254) NULL,
    `companyPhoneSnapshot` VARCHAR(50) NULL,
    `bankName` VARCHAR(100) NULL,
    `accountNumber` VARCHAR(100) NULL,
    `totalEarnings` DECIMAL(18, 0) NOT NULL DEFAULT 0,
    `totalDeductions` DECIMAL(18, 0) NOT NULL DEFAULT 0,
    `takeHomePay` DECIMAL(18, 0) NOT NULL DEFAULT 0,
    `version` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `publishedAt` DATETIME(3) NULL,
    `createdById` CHAR(36) NOT NULL,
    `updatedById` CHAR(36) NOT NULL,
    `publishedById` CHAR(36) NULL,
    `templateVersion` VARCHAR(50) NOT NULL DEFAULT 'v1',

    UNIQUE INDEX `payslip_userId_year_month_key` (`userId`, `year`, `month`),
    INDEX `payslip_userId_status_year_month_idx` (`userId`, `status`, `year`, `month`),
    INDEX `payslip_year_month_status_idx` (`year`, `month`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `payslipitem` (
    `id` CHAR(36) NOT NULL,
    `payslipId` CHAR(36) NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `category` ENUM('EARNING', 'DEDUCTION') NOT NULL,
    `amount` DECIMAL(18, 0) NOT NULL,
    `sortOrder` INTEGER NOT NULL,

    UNIQUE INDEX `payslipitem_payslipId_category_sortOrder_key` (`payslipId`, `category`, `sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Only the new tables are altered. The existing physical User table is lowercase.
ALTER TABLE `payslip` ADD CONSTRAINT `payslip_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `user` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `payslipitem` ADD CONSTRAINT `payslipitem_payslipId_fkey`
    FOREIGN KEY (`payslipId`) REFERENCES `payslip` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;
