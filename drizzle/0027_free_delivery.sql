-- Keep the gross items subtotal in subtotal_in_centavos; discounts must be separate.
-- This also covers subtotal reductions made by a partial-item cancellation.
CREATE FUNCTION enforce_order_free_delivery() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
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
      -- Payment or fulfilment already in progress must be handled by its money/stock workflow.
      IF OLD.status NOT IN ('placed', 'confirmed') THEN
        RAISE EXCEPTION 'Cancel items before payment or packing; otherwise use the Return approval workflow.';
      END IF;
      NEW.delivery_fee_in_centavos := NULL;
      NEW.status := 'placed';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER orders_free_delivery
BEFORE INSERT OR UPDATE OF subtotal_in_centavos, delivery_fee_in_centavos ON orders
FOR EACH ROW EXECUTE FUNCTION enforce_order_free_delivery();
