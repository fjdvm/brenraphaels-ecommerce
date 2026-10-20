-- The database role CREOMS connects as. For the owner to run once, by hand, against the shared Neon database
-- (nothing in this repo runs it). It can read and write Tickets and Messages and nothing else.
-- Replace the password placeholder before running; never commit the real one.

CREATE ROLE creoms_tickets LOGIN PASSWORD 'REPLACE_WITH_A_STRONG_PASSWORD';

-- Start from nothing: no database-wide surprises, and no access to any other table.
REVOKE ALL ON SCHEMA public FROM creoms_tickets;
GRANT USAGE ON SCHEMA public TO creoms_tickets;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE tickets, ticket_messages TO creoms_tickets;
-- Both tables use identity columns, so inserting needs their sequences.
GRANT USAGE, SELECT ON SEQUENCE tickets_id_seq, ticket_messages_id_seq TO creoms_tickets;
