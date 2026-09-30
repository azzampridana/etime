-- Historical sessions retain the previous 12-hour policy. No evidence is rewritten.
ALTER TABLE `overtime` ADD COLUMN `maxOpenMinutes` SMALLINT UNSIGNED NOT NULL DEFAULT 720;

CREATE TABLE `overtimepolicy` (
    `id` TINYINT UNSIGNED NOT NULL DEFAULT 1,
    `maxOpenMinutes` SMALLINT UNSIGNED NOT NULL DEFAULT 720,
    `updatedAt` DATETIME(3) NOT NULL,
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `overtimepolicy` (`id`, `maxOpenMinutes`, `updatedAt`)
VALUES (1, 720, CURRENT_TIMESTAMP(3));
