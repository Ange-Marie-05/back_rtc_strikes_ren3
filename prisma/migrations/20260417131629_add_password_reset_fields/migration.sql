-- AlterTable
ALTER TABLE "User" ADD COLUMN     "PasswordResetToken" TEXT,
ADD COLUMN     "PasswordResetTokenExp" TIMESTAMP(3);
