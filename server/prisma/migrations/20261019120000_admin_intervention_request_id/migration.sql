ALTER TABLE `AuditLog` ADD COLUMN `requestId` VARCHAR(64) NULL;
CREATE UNIQUE INDEX `AuditLog_requestId_key` ON `AuditLog`(`requestId`);
