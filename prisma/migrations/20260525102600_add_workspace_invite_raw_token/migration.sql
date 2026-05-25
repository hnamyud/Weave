ALTER TABLE "workspace_invites"
ADD COLUMN "raw_token" TEXT;

CREATE UNIQUE INDEX "workspace_invites_raw_token_key"
ON "workspace_invites"("raw_token");
