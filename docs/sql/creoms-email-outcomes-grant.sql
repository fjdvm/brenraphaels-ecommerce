-- Lets CREOMS read whether an Order's confirmation email went out. For the owner to run once, by hand, against the
-- shared Neon database (nothing in this repo runs it), after migration 0051. Read-only: CREOMS cannot change an outcome.
-- Only the outcome columns are granted, which is every column of the table.

GRANT SELECT (order_id, kind, status, reason, attempts, next_attempt_at, created_at, updated_at)
  ON TABLE order_email_outcomes TO creoms_readonly;
