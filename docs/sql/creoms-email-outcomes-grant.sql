-- Lets CREOMS read whether an Order's emails went out. For the owner to run once, by hand, against the shared Neon
-- database (nothing in this repo runs it), after migration 0053. Read-only: CREOMS cannot change an outcome.
-- Only the outcome columns are granted. `message_id` is the provider's id and stays private to the storefront.

GRANT SELECT (order_id, kind, occurrence, status, reason, attempts, next_attempt_at, created_at, updated_at)
  ON TABLE order_email_outcomes TO creoms_readonly;
