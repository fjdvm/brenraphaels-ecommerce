ALTER TABLE "senior_pwd_verifications" ADD COLUMN IF NOT EXISTS "id_number_read" text;--> statement-breakpoint
ALTER TABLE "senior_pwd_verifications" ADD COLUMN IF NOT EXISTS "verified_name" text;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'senior_pwd_verifications_id_number_read') THEN
    ALTER TABLE "senior_pwd_verifications" ADD CONSTRAINT "senior_pwd_verifications_id_number_read" CHECK ("senior_pwd_verifications"."id_number_read" in ('matched', 'differs', 'unread'));
  END IF;
END $$;
