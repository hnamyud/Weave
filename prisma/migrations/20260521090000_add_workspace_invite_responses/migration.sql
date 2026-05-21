CREATE TYPE "WorkspaceInviteType" AS ENUM ('DIRECT', 'LINK');

CREATE TYPE "WorkspaceInviteResponseStatus" AS ENUM ('ACCEPTED', 'DENIED');

ALTER TABLE "workspace_invites"
  ADD COLUMN "type" "WorkspaceInviteType" NOT NULL DEFAULT 'LINK',
  ADD COLUMN "invited_user_id" UUID,
  ADD COLUMN "invited_email" TEXT,
  ADD COLUMN "max_uses" INTEGER,
  ADD COLUMN "used_count" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "workspace_invites"
  ALTER COLUMN "token_hash" DROP NOT NULL,
  DROP COLUMN IF EXISTS "used_at";

ALTER TABLE "workspace_invites"
  ALTER COLUMN "type" DROP DEFAULT;

CREATE TABLE "workspace_invite_responses" (
  "id" UUID NOT NULL,
  "invite_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "status" "WorkspaceInviteResponseStatus" NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "workspace_invite_responses_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "workspace_invites_created_by_id_idx" ON "workspace_invites"("created_by_id");
CREATE INDEX "workspace_invites_invited_user_id_idx" ON "workspace_invites"("invited_user_id");
CREATE INDEX "workspace_invite_responses_user_id_idx" ON "workspace_invite_responses"("user_id");
CREATE UNIQUE INDEX "workspace_invite_responses_invite_id_user_id_key" ON "workspace_invite_responses"("invite_id", "user_id");

ALTER TABLE "workspace_invites"
  ADD CONSTRAINT "workspace_invites_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "workspace_invites"
  ADD CONSTRAINT "workspace_invites_invited_user_id_fkey"
  FOREIGN KEY ("invited_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "workspace_invite_responses"
  ADD CONSTRAINT "workspace_invite_responses_invite_id_fkey"
  FOREIGN KEY ("invite_id") REFERENCES "workspace_invites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "workspace_invite_responses"
  ADD CONSTRAINT "workspace_invite_responses_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
