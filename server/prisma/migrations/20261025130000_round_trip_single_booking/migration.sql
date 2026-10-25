ALTER TABLE `Booking`
  ADD COLUMN `returnFlightId` INTEGER NULL,
  ADD COLUMN `outboundUnitPrice` INTEGER NULL,
  ADD COLUMN `returnUnitPrice` INTEGER NULL;

CREATE INDEX `Booking_returnFlightId_status_idx` ON `Booking`(`returnFlightId`, `status`);
ALTER TABLE `Booking` ADD CONSTRAINT `Booking_returnFlightId_fkey`
  FOREIGN KEY (`returnFlightId`) REFERENCES `Flight`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `Ticket` ADD COLUMN `flightId` INTEGER NULL;
UPDATE `Ticket` t
  JOIN `Passenger` p ON p.id = t.passengerId
  JOIN `Booking` b ON b.id = p.bookingId
  SET t.flightId = b.flightId;
ALTER TABLE `Ticket` MODIFY COLUMN `flightId` INTEGER NOT NULL;
CREATE UNIQUE INDEX `Ticket_passengerId_flightId_key` ON `Ticket`(`passengerId`, `flightId`);
DROP INDEX `Ticket_passengerId_key` ON `Ticket`;
CREATE INDEX `Ticket_flightId_status_idx` ON `Ticket`(`flightId`, `status`);
ALTER TABLE `Ticket` ADD CONSTRAINT `Ticket_flightId_fkey`
  FOREIGN KEY (`flightId`) REFERENCES `Flight`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
