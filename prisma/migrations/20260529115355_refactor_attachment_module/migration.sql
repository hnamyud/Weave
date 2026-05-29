/*
  Warnings:

  - You are about to drop the column `file_size` on the `attachments` table. All the data in the column will be lost.
  - You are about to drop the column `file_type` on the `attachments` table. All the data in the column will be lost.
  - You are about to drop the column `metadata` on the `attachments` table. All the data in the column will be lost.
  - You are about to drop the column `storage_url` on the `attachments` table. All the data in the column will be lost.
  - Added the required column `file_object_id` to the `attachments` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "attachments" DROP COLUMN "file_size",
DROP COLUMN "file_type",
DROP COLUMN "metadata",
DROP COLUMN "storage_url",
ADD COLUMN     "file_object_id" UUID NOT NULL,
ADD COLUMN     "is_deleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "deleted_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "file_objects" (
    "id" UUID NOT NULL,
    "storage_key" TEXT NOT NULL,
    "file_hash" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_type" TEXT,
    "file_size" INTEGER,
    "uploader_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "file_objects_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "file_objects_storage_key_key" ON "file_objects"("storage_key");

-- CreateIndex
CREATE INDEX "file_objects_uploader_id_idx" ON "file_objects"("uploader_id");

-- CreateIndex
CREATE UNIQUE INDEX "file_objects_file_hash_file_size_key" ON "file_objects"("file_hash", "file_size");

-- CreateIndex
CREATE INDEX "attachments_file_object_id_idx" ON "attachments"("file_object_id");

-- AddForeignKey
ALTER TABLE "file_objects" ADD CONSTRAINT "file_objects_uploader_id_fkey" FOREIGN KEY ("uploader_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_file_object_id_fkey" FOREIGN KEY ("file_object_id") REFERENCES "file_objects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "attachments_message_id_is_deleted_idx" ON "attachments"("message_id", "is_deleted");
