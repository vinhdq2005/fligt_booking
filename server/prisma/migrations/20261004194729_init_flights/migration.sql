-- CreateTable
CREATE TABLE `FlightSearch` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `departureCode` CHAR(3) NOT NULL,
    `arrivalCode` CHAR(3) NOT NULL,
    `outboundDate` DATE NOT NULL,
    `adults` INTEGER NOT NULL DEFAULT 1,
    `travelClass` INTEGER NOT NULL DEFAULT 1,
    `currency` CHAR(3) NOT NULL DEFAULT 'VND',
    `fetchedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NOT NULL,
    `lowestPrice` INTEGER NULL,
    `priceLevel` VARCHAR(20) NULL,
    `typicalPriceLow` INTEGER NULL,
    `typicalPriceHigh` INTEGER NULL,

    INDEX `FlightSearch_departureCode_arrivalCode_outboundDate_adults_t_idx`(`departureCode`, `arrivalCode`, `outboundDate`, `adults`, `travelClass`, `currency`, `fetchedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FlightOffer` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `searchId` INTEGER NOT NULL,
    `category` VARCHAR(10) NOT NULL,
    `position` INTEGER NOT NULL,
    `price` INTEGER NOT NULL,
    `totalDurationMinutes` INTEGER NULL,

    UNIQUE INDEX `FlightOffer_searchId_category_position_key`(`searchId`, `category`, `position`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FlightSegment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `offerId` INTEGER NOT NULL,
    `position` INTEGER NOT NULL,
    `flightNumber` VARCHAR(20) NOT NULL,
    `airlineName` VARCHAR(120) NOT NULL,
    `departureCode` CHAR(3) NOT NULL,
    `arrivalCode` CHAR(3) NOT NULL,
    `departureTime` DATETIME(0) NOT NULL,
    `arrivalTime` DATETIME(0) NOT NULL,
    `durationMinutes` INTEGER NULL,

    UNIQUE INDEX `FlightSegment_offerId_position_key`(`offerId`, `position`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `FlightOffer` ADD CONSTRAINT `FlightOffer_searchId_fkey` FOREIGN KEY (`searchId`) REFERENCES `FlightSearch`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FlightSegment` ADD CONSTRAINT `FlightSegment_offerId_fkey` FOREIGN KEY (`offerId`) REFERENCES `FlightOffer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
