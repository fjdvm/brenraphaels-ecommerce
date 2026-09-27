# Ecommerce and CREOMS integrate over API/webhook, not a shared database

Orders will eventually be managed from the staff side by CREOMS (Customer Relationship & E-commerce Ordering Management System), a separate application built later. CREOMS has its own database and its own auth (not Neon Auth), so the two apps cannot share the `customers`/`orders` schema the way this app's own tables do. We chose to have this app own Order data outright and remain its source of truth, exposing it to CREOMS over an API/webhook boundary, rather than pointing both apps at one shared Neon database or handing Order ownership to CREOMS from day one. CREOMS does not exist yet, so nothing calls this boundary from the outside today; this app instead exposes a thin internal, secret-guarded endpoint that updates an Order's status and Delivery fee, standing in for CREOMS until it is built.

## Consequences

- This app's schema (`customers`, `orders`, `order_items`, `feedback`, …) is the only copy of that data; CREOMS reads and writes it only through whatever API contract gets designed when CREOMS is built, never directly against this app's Postgres.
- A cross-database join (e.g. "which CRM contact placed this Order") is not possible in SQL; any such view has to be assembled by one app calling the other's API.
- Until CREOMS exists, Order status and Delivery fee are advanced by calling this app's internal endpoint by hand (or scripted), not by editing the database directly, so the same validated transition logic applies from day one.
- The internal endpoint's authentication (a shared secret) is a placeholder; when CREOMS is built, its calls need a real auth story (e.g. a scoped service credential), and the shared secret should be retired then.
- Feedback, like Orders, lives only in this app's database; CREOMS reads it the same way, over the API, not via direct DB access.
