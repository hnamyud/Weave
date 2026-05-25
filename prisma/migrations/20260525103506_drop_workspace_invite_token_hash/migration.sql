/*
  Warnings:

  - You are about to drop the column `token_hash` on the `workspace_invites` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "workspace_invites_token_hash_key";

-- AlterTable
ALTER TABLE "workspace_invites" DROP COLUMN "token_hash";
