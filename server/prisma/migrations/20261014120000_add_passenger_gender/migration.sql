-- Existing passenger rows remain valid; backfill them before making these columns required.
ALTER TABLE `Passenger`
  ADD COLUMN `gender` ENUM('MALE', 'FEMALE') NULL;
