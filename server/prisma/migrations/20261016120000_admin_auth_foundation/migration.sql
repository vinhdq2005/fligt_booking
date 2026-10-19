ALTER TABLE `Airline` ADD COLUMN `status` ENUM('ACTIVE', 'LOCKED') NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE `Flight` ADD COLUMN `saleStatus` ENUM('ON_SALE', 'HIDDEN') NOT NULL DEFAULT 'ON_SALE';
ALTER TABLE `Booking` ADD COLUMN `userId` INTEGER NULL;
ALTER TABLE `Payment` ADD COLUMN `reviewStatus` ENUM('NONE', 'NEEDS_REVIEW', 'RESOLVED') NOT NULL DEFAULT 'NONE';

CREATE TABLE `User` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(120) NOT NULL,
  `email` VARCHAR(255) NOT NULL,
  `passwordHash` VARCHAR(255) NOT NULL,
  `role` ENUM('ADMIN', 'CUSTOMER', 'AIRLINE_FLIGHT_MANAGER', 'AIRLINE_SALES_MANAGER') NOT NULL DEFAULT 'CUSTOMER',
  `status` ENUM('ACTIVE', 'LOCKED') NOT NULL DEFAULT 'ACTIVE',
  `airlineId` INTEGER NULL,
  `phone` VARCHAR(20) NULL,
  `lastLoginAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `User_email_key`(`email`),
  INDEX `User_airlineId_role_status_idx`(`airlineId`, `role`, `status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `AuthSession` (
  `id` CHAR(64) NOT NULL,
  `userId` INTEGER NOT NULL,
  `expiresAt` DATETIME(3) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `AuthSession_userId_idx`(`userId`),
  INDEX `AuthSession_expiresAt_idx`(`expiresAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `AuditLog` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `actorId` INTEGER NOT NULL,
  `action` VARCHAR(80) NOT NULL,
  `entityType` VARCHAR(80) NOT NULL,
  `entityId` VARCHAR(80) NOT NULL,
  `reason` VARCHAR(1000) NULL,
  `before` JSON NULL,
  `after` JSON NULL,
  `result` VARCHAR(20) NOT NULL DEFAULT 'SUCCESS',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `AuditLog_entityType_entityId_createdAt_idx`(`entityType`, `entityId`, `createdAt`),
  INDEX `AuditLog_actorId_createdAt_idx`(`actorId`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `Booking_userId_createdAt_idx` ON `Booking`(`userId`, `createdAt`);
ALTER TABLE `User` ADD CONSTRAINT `User_airlineId_fkey` FOREIGN KEY (`airlineId`) REFERENCES `Airline`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `AuthSession` ADD CONSTRAINT `AuthSession_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `AuditLog` ADD CONSTRAINT `AuditLog_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Booking` ADD CONSTRAINT `Booking_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
