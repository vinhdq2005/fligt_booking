-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "FlightStatus" AS ENUM ('SCHEDULED', 'BOARDING', 'DEPARTED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('ISSUED', 'USED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PassengerGender" AS ENUM ('MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'CUSTOMER', 'AIRLINE_FLIGHT_MANAGER', 'AIRLINE_SALES_MANAGER');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'LOCKED');

-- CreateEnum
CREATE TYPE "AirlineStatus" AS ENUM ('ACTIVE', 'LOCKED');

-- CreateEnum
CREATE TYPE "FlightSaleStatus" AS ENUM ('ON_SALE', 'HIDDEN');

-- CreateEnum
CREATE TYPE "PaymentReviewStatus" AS ENUM ('NONE', 'NEEDS_REVIEW', 'RESOLVED');

-- CreateTable
CREATE TABLE "FlightSearch" (
    "id" SERIAL NOT NULL,
    "departureCode" CHAR(3) NOT NULL,
    "arrivalCode" CHAR(3) NOT NULL,
    "outboundDate" DATE NOT NULL,
    "adults" INTEGER NOT NULL DEFAULT 1,
    "travelClass" INTEGER NOT NULL DEFAULT 1,
    "currency" CHAR(3) NOT NULL DEFAULT 'VND',
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lowestPrice" INTEGER,
    "priceLevel" VARCHAR(20),
    "typicalPriceLow" INTEGER,
    "typicalPriceHigh" INTEGER,

    CONSTRAINT "FlightSearch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FlightOffer" (
    "id" SERIAL NOT NULL,
    "searchId" INTEGER NOT NULL,
    "category" VARCHAR(10) NOT NULL,
    "position" INTEGER NOT NULL,
    "price" INTEGER NOT NULL,
    "totalDurationMinutes" INTEGER,

    CONSTRAINT "FlightOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FlightSegment" (
    "id" SERIAL NOT NULL,
    "offerId" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "flightNumber" VARCHAR(20) NOT NULL,
    "airlineName" VARCHAR(120) NOT NULL,
    "departureCode" CHAR(3) NOT NULL,
    "arrivalCode" CHAR(3) NOT NULL,
    "departureTime" TIMESTAMP(0) NOT NULL,
    "arrivalTime" TIMESTAMP(0) NOT NULL,
    "durationMinutes" INTEGER,

    CONSTRAINT "FlightSegment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Airline" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(10) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "status" "AirlineStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Airline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "passwordHash" VARCHAR(255) NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'CUSTOMER',
    "status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "airlineId" INTEGER,
    "phone" VARCHAR(20),
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthSession" (
    "id" CHAR(64) NOT NULL,
    "userId" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" SERIAL NOT NULL,
    "requestId" VARCHAR(64),
    "actorId" INTEGER NOT NULL,
    "action" VARCHAR(80) NOT NULL,
    "entityType" VARCHAR(80) NOT NULL,
    "entityId" VARCHAR(80) NOT NULL,
    "reason" VARCHAR(1000),
    "before" JSONB,
    "after" JSONB,
    "result" VARCHAR(20) NOT NULL DEFAULT 'SUCCESS',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Flight" (
    "id" SERIAL NOT NULL,
    "flightNumber" VARCHAR(20) NOT NULL,
    "airlineId" INTEGER NOT NULL,
    "departureCode" CHAR(3) NOT NULL,
    "arrivalCode" CHAR(3) NOT NULL,
    "departureTime" TIMESTAMP(0) NOT NULL,
    "arrivalTime" TIMESTAMP(0) NOT NULL,
    "capacity" INTEGER NOT NULL,
    "basePrice" INTEGER NOT NULL,
    "status" "FlightStatus" NOT NULL DEFAULT 'SCHEDULED',
    "saleStatus" "FlightSaleStatus" NOT NULL DEFAULT 'ON_SALE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Flight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" SERIAL NOT NULL,
    "bookingCode" VARCHAR(30) NOT NULL,
    "flightId" INTEGER NOT NULL,
    "returnFlightId" INTEGER,
    "outboundUnitPrice" INTEGER,
    "returnUnitPrice" INTEGER,
    "userId" INTEGER,
    "contactName" VARCHAR(120) NOT NULL,
    "contactEmail" VARCHAR(255),
    "contactPhone" VARCHAR(20),
    "totalAmount" INTEGER NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Passenger" (
    "id" SERIAL NOT NULL,
    "bookingId" INTEGER NOT NULL,
    "fullName" VARCHAR(120) NOT NULL,
    "documentNumber" VARCHAR(50),
    "gender" "PassengerGender",
    "dateOfBirth" DATE,
    "nationality" VARCHAR(80),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Passenger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ticket" (
    "id" SERIAL NOT NULL,
    "passengerId" INTEGER NOT NULL,
    "flightId" INTEGER NOT NULL,
    "ticketCode" VARCHAR(30) NOT NULL,
    "qrToken" VARCHAR(64) NOT NULL,
    "price" INTEGER NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'ISSUED',
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usedAt" TIMESTAMP(3),

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PricingRule" (
    "id" SERIAL NOT NULL,
    "flightId" INTEGER NOT NULL,
    "minOccupancyPercent" DECIMAL(5,2) NOT NULL,
    "maxOccupancyPercent" DECIMAL(5,2) NOT NULL,
    "price" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PricingRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" SERIAL NOT NULL,
    "bookingId" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'VND',
    "method" VARCHAR(30) NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "reviewStatus" "PaymentReviewStatus" NOT NULL DEFAULT 'NONE',
    "providerTransactionId" VARCHAR(120),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FlightSearch_departureCode_arrivalCode_outboundDate_adults__idx" ON "FlightSearch"("departureCode", "arrivalCode", "outboundDate", "adults", "travelClass", "currency", "fetchedAt");

-- CreateIndex
CREATE UNIQUE INDEX "FlightOffer_searchId_category_position_key" ON "FlightOffer"("searchId", "category", "position");

-- CreateIndex
CREATE UNIQUE INDEX "FlightSegment_offerId_position_key" ON "FlightSegment"("offerId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "Airline_code_key" ON "Airline"("code");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_airlineId_role_status_idx" ON "User"("airlineId", "role", "status");

-- CreateIndex
CREATE INDEX "AuthSession_userId_idx" ON "AuthSession"("userId");

-- CreateIndex
CREATE INDEX "AuthSession_expiresAt_idx" ON "AuthSession"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "AuditLog_requestId_key" ON "AuditLog"("requestId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_createdAt_idx" ON "AuditLog"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "Flight_departureCode_arrivalCode_departureTime_status_idx" ON "Flight"("departureCode", "arrivalCode", "departureTime", "status");

-- CreateIndex
CREATE INDEX "Flight_airlineId_departureTime_idx" ON "Flight"("airlineId", "departureTime");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_bookingCode_key" ON "Booking"("bookingCode");

-- CreateIndex
CREATE INDEX "Booking_flightId_status_idx" ON "Booking"("flightId", "status");

-- CreateIndex
CREATE INDEX "Booking_returnFlightId_status_idx" ON "Booking"("returnFlightId", "status");

-- CreateIndex
CREATE INDEX "Booking_createdAt_idx" ON "Booking"("createdAt");

-- CreateIndex
CREATE INDEX "Booking_userId_createdAt_idx" ON "Booking"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Passenger_bookingId_idx" ON "Passenger"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_ticketCode_key" ON "Ticket"("ticketCode");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_qrToken_key" ON "Ticket"("qrToken");

-- CreateIndex
CREATE INDEX "Ticket_flightId_status_idx" ON "Ticket"("flightId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_passengerId_flightId_key" ON "Ticket"("passengerId", "flightId");

-- CreateIndex
CREATE INDEX "PricingRule_flightId_minOccupancyPercent_idx" ON "PricingRule"("flightId", "minOccupancyPercent");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_providerTransactionId_key" ON "Payment"("providerTransactionId");

-- CreateIndex
CREATE INDEX "Payment_bookingId_status_idx" ON "Payment"("bookingId", "status");

-- AddForeignKey
ALTER TABLE "FlightOffer" ADD CONSTRAINT "FlightOffer_searchId_fkey" FOREIGN KEY ("searchId") REFERENCES "FlightSearch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlightSegment" ADD CONSTRAINT "FlightSegment_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "FlightOffer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_airlineId_fkey" FOREIGN KEY ("airlineId") REFERENCES "Airline"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Flight" ADD CONSTRAINT "Flight_airlineId_fkey" FOREIGN KEY ("airlineId") REFERENCES "Airline"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_flightId_fkey" FOREIGN KEY ("flightId") REFERENCES "Flight"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_returnFlightId_fkey" FOREIGN KEY ("returnFlightId") REFERENCES "Flight"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Passenger" ADD CONSTRAINT "Passenger_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_passengerId_fkey" FOREIGN KEY ("passengerId") REFERENCES "Passenger"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_flightId_fkey" FOREIGN KEY ("flightId") REFERENCES "Flight"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PricingRule" ADD CONSTRAINT "PricingRule_flightId_fkey" FOREIGN KEY ("flightId") REFERENCES "Flight"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
