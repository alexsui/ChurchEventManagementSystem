/*
  Warnings:

  - You are about to drop the column `registrationMode` on the `Event` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Event" DROP COLUMN "registrationMode";

-- DropEnum
DROP TYPE "RegistrationMode";
