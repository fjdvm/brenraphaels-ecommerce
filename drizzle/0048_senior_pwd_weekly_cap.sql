-- What the ID's ₱125 weekly cap did to an Order's Senior/PWD discount, saved at confirmation; existing Orders keep them empty.
ALTER TABLE "orders" ADD COLUMN "senior_pwd_allowance_used_in_centavos" integer;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "senior_pwd_reduction_reason" text;
