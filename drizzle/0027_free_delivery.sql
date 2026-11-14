ALTER TABLE orders ADD COLUMN delivery_fee_quote_required boolean NOT NULL DEFAULT false;
--> statement-breakpoint
-- Keep the gross items subtotal in subtotal_in_centavos; discounts must be separate.
-- This also covers subtotal reductions made by a partial-item cancellation.
CREATE FUNCTION enforce_order_free_delivery() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.delivery_fee_in_centavos IS NOT NULL THEN
    NEW.delivery_fee_quote_required := false;
  END IF;
  IF NEW.fulfillment_method = 'delivery' THEN
    IF NEW.subtotal_in_centavos > 250000 THEN
      IF NEW.delivery_fee_in_centavos IS NOT NULL AND NEW.delivery_fee_in_centavos <> 0 THEN
        RAISE EXCEPTION 'Free delivery applies to this Order. The Delivery fee must be ₱0.';
      END IF;
      NEW.delivery_fee_in_centavos := 0;
      IF TG_OP = 'INSERT' AND NEW.status = 'placed' THEN
        NEW.status := 'confirmed';
      END IF;
    ELSIF TG_OP = 'UPDATE' AND OLD.fulfillment_method = 'delivery'
      AND OLD.subtotal_in_centavos > 250000 AND OLD.delivery_fee_in_centavos = 0
      AND NEW.subtotal_in_centavos <> OLD.subtotal_in_centavos THEN
      NEW.delivery_fee_in_centavos := NULL;
      NEW.delivery_fee_quote_required := true;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER orders_free_delivery
BEFORE INSERT OR UPDATE OF subtotal_in_centavos, delivery_fee_in_centavos ON orders
FOR EACH ROW EXECUTE FUNCTION enforce_order_free_delivery();

--> statement-breakpoint
-- Cancelled snapshots remain immutable even when active Order lines are removed.
CREATE TABLE order_cancelled_items (
  order_id integer NOT NULL REFERENCES orders(id),
  order_line_id integer PRIMARY KEY,
  product_name text NOT NULL,
  size_label text NOT NULL,
  price_in_centavos integer NOT NULL,
  quantity integer NOT NULL,
  staff_id text NOT NULL,
  staff_name text NOT NULL,
  cancelled_at timestamptz NOT NULL DEFAULT now()
);
