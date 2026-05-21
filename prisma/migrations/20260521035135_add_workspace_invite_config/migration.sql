/*
  Warnings:

  - You are about to drop the column `invited_email` on the `workspace_invites` table. All the data in the column will be lost.
  - You are about to drop the column `max_uses` on the `workspace_invites` table. All the data in the column will be lost.
  - You are about to drop the column `used_count` on the `workspace_invites` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "workspace_invites" DROP COLUMN "invited_email",
DROP COLUMN "max_uses",
DROP COLUMN "used_count";
