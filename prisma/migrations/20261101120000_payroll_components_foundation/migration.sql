-- Prepared only; no execution or seed. UUID and updatedAt are Prisma-managed.
CREATE TABLE `payrollcomponent` (
    `id` CHAR(36) NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `category` ENUM('EARNING', 'DEDUCTION') NOT NULL,
    `sortOrder` INTEGER NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `version` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `payrollcomponent_category_name_key` (`category`, `name`),
    INDEX `payrollcomponent_active_order_idx` (`isActive`, `category`, `sortOrder`, `id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
