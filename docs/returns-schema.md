# Return schema for CREOMS

Drizzle migration `0019_order_returns` adds the storefront-owned tables required by CREOMS tickets [#170](https://github.com/fjdvm/epic-crms/issues/170) and [#171](https://github.com/fjdvm/epic-crms/issues/171):

- `order_returns`: Order, status, reason, Customer note, refund amount in centavos, goods-required decision, decline reason and request/refund times.
- `order_return_items`: immutable whole-line snapshots keyed by Return and Order line.
- `order_return_images`: one to three ordered private File references.
- `order_return_history`: Customer/Staff identity snapshots and the time of each step. Staff identity is the Portal username and name.

Statuses are `requested`, `approved`, `goods received`, `refunded`, `declined` and `cancelled`; reasons are `damaged`, `defective`, `wrong item` and `other`. The migration creates tables, keys, constraints and an Order lookup index. It neither changes existing Orders/Customers nor creates Return requests or moves money. Existing Orders require no backfill.

Apply with the existing `npm run db:migrate` workflow and `DATABASE_URL_UNPOOLED`, using a direct connection. Afterwards the database owner applies CREOMS's `docs/db/creoms-returns-readonly.sql` to grant SELECT and revoke writes on these four tables for `creoms_readonly`.

The schema matches CREOMS's documented read contract. Customer request endpoints, the 24-hour request rule, Staff decision endpoints and Customer emails/Notifications are separate storefront work. Creating the tables alone does not deploy those endpoints.

Validation includes migrating a database with existing Orders, round-tripping all four tables, rerunning Drizzle without losing data, and rejecting invalid amounts/image positions. The migration and permissions are also checked on an isolated Neon copy of production before live application.
