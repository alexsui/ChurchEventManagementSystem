-- CreateEnum
CREATE TYPE "FormFieldType" AS ENUM ('TEXT', 'YES_NO', 'SINGLE_CHOICE');

-- CreateTable
CREATE TABLE "EventFormField" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "type" "FormFieldType" NOT NULL,
    "label" TEXT NOT NULL,
    "options" TEXT[],
    "required" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventFormField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventFormResponse" (
    "id" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventFormResponse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EventFormResponse_registrationId_fieldId_key" ON "EventFormResponse"("registrationId", "fieldId");

-- AddForeignKey
ALTER TABLE "EventFormField" ADD CONSTRAINT "EventFormField_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventFormResponse" ADD CONSTRAINT "EventFormResponse_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "Registration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventFormResponse" ADD CONSTRAINT "EventFormResponse_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "EventFormField"("id") ON DELETE CASCADE ON UPDATE CASCADE;
