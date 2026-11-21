-- AlterTable
ALTER TABLE "PunchRecord" ADD COLUMN     "punchedById" TEXT;

-- AddForeignKey
ALTER TABLE "PunchRecord" ADD CONSTRAINT "PunchRecord_punchedById_fkey" FOREIGN KEY ("punchedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
