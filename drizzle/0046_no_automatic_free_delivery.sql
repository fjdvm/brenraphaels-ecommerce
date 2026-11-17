-- Delivery fees are always entered by Staff or a Manager (₱0 included); nothing is free automatically.
-- Orders already confirmed under the old rule keep their fee and status: only the trigger changes, no rows do.
CREATE OR REPLACE FUNCTION enforce_order_free_delivery() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.delivery_fee_in_centavos IS NOT NULL THEN
    NEW.delivery_fee_quote_required := false;
  END IF;
  RETURN NEW;
END;
$$;
