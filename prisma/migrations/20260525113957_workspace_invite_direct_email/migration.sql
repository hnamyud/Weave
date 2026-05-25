/*
  Warnings:

  - You are about to drop the column `invited_user_id` on the `workspace_invites` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "workspace_invites" DROP CONSTRAINT "workspace_invites_invited_user_id_fkey";

-- DropIndex
DROP INDEX "workspace_invites_invited_user_id_idx";

-- AlterTable
ALTER TABLE "workspace_invites" DROP COLUMN "invited_user_id",
ADD COLUMN     "invited_email" TEXT;

-- CreateIndex
CREATE INDEX "workspace_invites_invited_email_idx" ON "workspace_invites"("invited_email");
