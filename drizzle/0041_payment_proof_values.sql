ALTER TABLE order_payment_proofs
  ADD COLUMN confirmed_amount_in_centavos integer CHECK (confirmed_amount_in_centavos >= 0),
  ADD COLUMN confirmed_paid_at timestamptz,
  ADD COLUMN confirmed_recipient text,
  ADD COLUMN expected_recipient text;
