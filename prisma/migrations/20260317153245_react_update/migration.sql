/*
  Warnings:

  - You are about to drop the `Reaction` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Reaction" DROP CONSTRAINT "Reaction_messageId_fkey";

-- DropForeignKey
ALTER TABLE "Reaction" DROP CONSTRAINT "Reaction_userId_fkey";

-- DropTable
DROP TABLE "Reaction";

-- CreateTable
CREATE TABLE "React" (
    "id" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,

    CONSTRAINT "React_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "React_messageId_idx" ON "React"("messageId");

-- CreateIndex
CREATE INDEX "React_userId_idx" ON "React"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "React_emoji_userId_messageId_key" ON "React"("emoji", "userId", "messageId");

-- AddForeignKey
ALTER TABLE "React" ADD CONSTRAINT "React_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "React" ADD CONSTRAINT "React_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
