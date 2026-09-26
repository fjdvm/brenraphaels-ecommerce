ALTER TABLE "customers" ADD COLUMN "first_name" text;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "middle_name" text;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "last_name" text;--> statement-breakpoint
-- Existing Customers only have a full name: the first word becomes the first
-- name and the rest the last name (a single word is used for both).
UPDATE "customers" SET
	"first_name" = split_part(btrim("full_name"), ' ', 1),
	"last_name" = CASE
		WHEN position(' ' IN btrim("full_name")) > 0
			THEN btrim(substr(btrim("full_name"), position(' ' IN btrim("full_name")) + 1))
		ELSE btrim("full_name")
	END;--> statement-breakpoint
ALTER TABLE "customers" ALTER COLUMN "first_name" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "customers" ALTER COLUMN "last_name" SET NOT NULL;
