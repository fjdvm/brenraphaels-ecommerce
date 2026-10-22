# Ecommerce owns Order writes; CREOMS reads Orders through a read-only role

Orders are managed from the staff side by CREOMS (Customer Relationship & E-commerce Ordering Management System), a separate application with its own auth (not Neon Auth). CREOMS and this app share one Neon database for Orders, but only for reading: CREOMS connects through a read-only role and never writes Order data directly. Every change to an Order (status, Delivery fee) goes through this app's credential-guarded Order status endpoint, so the transition rules and the Customer emails stay in the storefront and apply the same way whoever triggers the change. This app owns the schema and remains the source of truth for Order data.

## Consequences

- This app's schema (`customers`, `orders`, `order_items`, `feedback`, …) is the only copy of that data; CREOMS reads it through a read-only database role and writes it only through the Order status endpoint, never with direct writes against this app's Postgres.
- Because CREOMS reads the same database, it can join and filter Orders in SQL, but it depends on this app's schema: a migration here has to keep the read-only role's view of Orders working.
- Staff cancel an Order up to `preparing` through the status endpoint; a `dispatched` Order cannot be cancelled yet, because the transition rules do not allow it.
- The endpoint is guarded by a scoped CREOMS service credential: a short-lived signed token CREOMS mints from a signing key, valid only for Order status. The placeholder shared secret (`ORDER_STATUS_API_SECRET`) is retired. See [the credential doc](../creoms-service-credential.md).
- Feedback, like Orders, lives only in this app's database; CREOMS reads it the same way, through the read-only role.

**Note**: this boundary covers Orders (and Feedback) specifically. Support Tickets take the opposite approach — see [ADR-0007](./0007-support-tickets-integrate-via-shared-database.md).
