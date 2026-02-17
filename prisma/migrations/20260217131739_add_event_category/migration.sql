-- CreateEnum
CREATE TYPE "EventCategory" AS ENUM ('COURSE', 'LECTURE', 'CAMP');

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "category" "EventCategory";
