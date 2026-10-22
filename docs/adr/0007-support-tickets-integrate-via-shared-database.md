# Support tickets integrate via a shared database, unlike Orders

Support Ticket data will be shared directly between this app and CREOMS through one Neon database, rather than the read-only-role-plus-status-endpoint boundary ADR-0003 established for Orders. This app owns the `tickets`/`ticket_messages` schema and all of their migrations; CREOMS, once built, connects to the same tables directly and runs no migrations of its own against them. Staff identity stays fully out of this database either way: CREOMS authenticates staff through a separate, not-yet-built br-auth-service with its own Neon Auth and its own database, so a Message's staff sender is recorded as an opaque id plus a display-name snapshot taken at send time, with no foreign key possible into any staff table. Orders and Feedback are unaffected and continue to integrate the way ADR-0003 describes.

## Consequences

- Two integration patterns now exist between this app and CREOMS for two different kinds of data: Orders/Feedback over a read-only role and the status endpoint (ADR-0003), Tickets over a shared database (this ADR). A future context or data type has to pick one deliberately rather than assuming either is "the" pattern.
- This app, being built first, has to own the Ticket schema outright; CREOMS can never run its own migration against `tickets`/`ticket_messages`.
- A Message's staff sender can't be joined against a staff table in SQL — only `sender_id` (opaque) and `sender_display_name` (a snapshot) are available, because staff identity lives in br-auth-service's own database.
- Until CREOMS and br-auth-service exist, Tickets have no reply path: a Customer can open a Ticket and send Messages, but nothing in this app answers them.
