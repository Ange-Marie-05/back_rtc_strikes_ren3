-- AlterTable
ALTER TABLE "ServerMember" ADD COLUMN     "banEndDate" TIMESTAMP(3),
ADD COLUMN     "banned" BOOLEAN NOT NULL DEFAULT false;
