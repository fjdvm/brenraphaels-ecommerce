ALTER TABLE "tickets" ADD COLUMN "hold_started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN "held_seconds" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE "tickets" SET "hold_started_at" = now() WHERE "status" = 'on_hold';--> statement-breakpoint
CREATE FUNCTION "tickets_track_hold"() RETURNS trigger AS $$
BEGIN
  IF NEW.status = 'on_hold' AND OLD.status IS DISTINCT FROM 'on_hold' THEN
    NEW.hold_started_at := now();
  ELSIF OLD.status = 'on_hold' AND NEW.status <> 'on_hold' THEN
    NEW.held_seconds := OLD.held_seconds + GREATEST(0, floor(extract(epoch FROM now() - coalesce(OLD.hold_started_at, now()))))::integer;
    NEW.hold_started_at := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER "tickets_track_hold" BEFORE UPDATE OF "status" ON "tickets" FOR EACH ROW EXECUTE FUNCTION "tickets_track_hold"();
