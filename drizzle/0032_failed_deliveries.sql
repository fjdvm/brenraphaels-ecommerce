CREATE TABLE failed_deliveries (
 id text PRIMARY KEY, order_id integer NOT NULL REFERENCES orders(id),
 reason text NOT NULL, next_step text NOT NULL, customer_message text NOT NULL,
 staff_id text NOT NULL, staff_name text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 disposition text CHECK (disposition IN ('restock', 'write-off')), disposed_at timestamptz,
 rebooked_at timestamptz, courier jsonb
);
--> statement-breakpoint
CREATE INDEX failed_deliveries_order ON failed_deliveries(order_id);
