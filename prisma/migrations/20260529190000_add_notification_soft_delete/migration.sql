ALTER TABLE "notifications"
ADD COLUMN "is_deleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "deleted_at" TIMESTAMP(3);

CREATE INDEX "notifications_user_id_is_deleted_is_read_created_at_idx"
ON "notifications"("user_id", "is_deleted", "is_read", "created_at" DESC);
