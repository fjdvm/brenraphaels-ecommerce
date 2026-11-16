-- The database role CREOMS connects as. For the owner to run once, by hand, against the shared Neon database
-- (nothing in this repo runs it). It can read and write Tickets and Messages and nothing else.
-- Replace the password placeholder before running; never commit the real one.

CREATE ROLE creoms_tickets LOGIN PASSWORD 'REPLACE_WITH_A_STRONG_PASSWORD';

-- Start from nothing: no database-wide surprises, and no access to any other table.
-- Neon runs Postgres 15+, where PUBLIC no longer has CREATE on the public schema; on older versions also run
-- REVOKE CREATE ON SCHEMA public FROM PUBLIC.
REVOKE ALL ON SCHEMA public FROM creoms_tickets;
GRANT USAGE ON SCHEMA public TO creoms_tickets;

-- Tickets are opened by the shop, so CREOMS only reads and updates them (priority, claim, status).
GRANT SELECT, UPDATE ON TABLE tickets TO creoms_tickets;
-- Messages are permanent once sent: CREOMS reads them and adds staff replies, never edits or deletes.
GRANT SELECT, INSERT ON TABLE ticket_messages TO creoms_tickets;
-- ticket_messages uses an identity column, so inserting needs its sequence.
GRANT USAGE, SELECT ON SEQUENCE ticket_messages_id_seq TO creoms_tickets;

-- Internal notes (fjdvm/epic-crms#386) are rows in ticket_messages with internal = true. The grants above already cover
-- them (table-level INSERT, so the new internal and author_name columns need nothing more). Re-running is harmless:
GRANT SELECT, INSERT ON TABLE ticket_messages TO creoms_tickets;
