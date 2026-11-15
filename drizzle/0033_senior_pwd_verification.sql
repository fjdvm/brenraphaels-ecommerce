CREATE TABLE "senior_pwd_verifications" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "senior_pwd_verifications_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"customer_id" text NOT NULL,
	"id_type" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"id_hash" text NOT NULL,
	"photo_file_id" text,
	"photo_back_file_id" text,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone,
	"decided_by_id" text,
	"decided_by_name" text,
	"decline_reason" text,
	"expires_on" date
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "senior_pwd_verification_id" integer;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "senior_pwd_discount_in_centavos" integer;--> statement-breakpoint
ALTER TABLE "senior_pwd_verifications" ADD CONSTRAINT "senior_pwd_verifications_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "senior_pwd_verifications_customer" ON "senior_pwd_verifications" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "senior_pwd_verifications_hash" ON "senior_pwd_verifications" USING btree ("id_hash");--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_senior_pwd_verification_id_senior_pwd_verifications_id_fk" FOREIGN KEY ("senior_pwd_verification_id") REFERENCES "public"."senior_pwd_verifications"("id") ON DELETE restrict ON UPDATE no action;