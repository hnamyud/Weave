DROP INDEX IF EXISTS "users_email_key";

CREATE UNIQUE INDEX IF NOT EXISTS "users_email_unique_active" 
ON "users"(email) 
WHERE "deleted_at" IS NULL;