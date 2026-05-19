/*
  Warnings:

  - The `device_info` column on the `refresh_tokens` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "refresh_tokens" DROP COLUMN "device_info",
ADD COLUMN     "device_info" JSONB;
