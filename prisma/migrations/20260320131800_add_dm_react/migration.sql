/*
  Warnings:

  - A unique constraint covering the columns `[emoji,userId,dmId]` on the table `React` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `dmId` to the `React` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "React" ADD COLUMN     "dmId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "React_dmId_idx" ON "React"("dmId");

-- CreateIndex
CREATE UNIQUE INDEX "React_emoji_userId_dmId_key" ON "React"("emoji", "userId", "dmId");

-- AddForeignKey
ALTER TABLE "React" ADD CONSTRAINT "React_dmId_fkey" FOREIGN KEY ("dmId") REFERENCES "DirectMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
