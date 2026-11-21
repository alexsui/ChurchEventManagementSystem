-- CreateTable
CREATE TABLE "PunchActivity" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PunchActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PunchMember" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedOn" DATE NOT NULL,
    "leftOn" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PunchMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PunchRecord" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "punchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PunchRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PunchMember_activityId_userId_key" ON "PunchMember"("activityId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "PunchRecord_memberId_date_key" ON "PunchRecord"("memberId", "date");

-- AddForeignKey
ALTER TABLE "PunchMember" ADD CONSTRAINT "PunchMember_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "PunchActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PunchMember" ADD CONSTRAINT "PunchMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PunchRecord" ADD CONSTRAINT "PunchRecord_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "PunchMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
