# Stock reservation lifecycle (epic-crms#336)

The IMS owns stock. The storefront keeps only immutable Order-line requests and
recovery state, never an available/reserved stock balance. Checkout uses the IMS
interface delivered by epic-crms#335. No client timer reads stock.

Before rollout, complete epic-crms#367: configure the IMS credential and its
Warehouse, apply its stock schema and map each storefront `sizes.id` explicitly
to one IMS `FinishedProducts.ProductId`. Do not infer a mapping from names or ids.
Set these server-only GitHub repository secrets (the Azure manifest reads the
`.env.production.example` inventory):

- `IMS_URL`: the deployed IMS origin.
- `IMS_SHOP_API_KEY`: the IMS service credential.
- `IMS_SIZE_PRODUCT_IDS`: JSON object, e.g. `{"7":123}` maps storefront Size 7 to IMS Size 123.

Missing configuration blocks checkout with “Try again in a few minutes.” Do not
roll out before every Size currently on sale is mapped. The Warehouse is chosen
by the IMS setting, never by a browser request. Existing Orders have no IMS
Reservation and are never retroactively reserved.

Apply `0029_stock_reservations.sql` with `npm run db:migrate` using the production
direct connection. This adds two tables without changing existing Order rows.
The generated snapshot also catches up prior hand-written migrations; the SQL
intentionally does not re-create their tables or columns. Its journal timestamp
is greater than `0028` so Drizzle does not skip it on an existing database.

Checkout records a durable intent before contacting IMS. Its UUID and Size-based
line references survive ambiguous requests. The Order and Cart changes commit
only after every line is reserved. Customer-row locks serialize checkouts of one
Cart. A failed checkout attempts compensation immediately; a crash or outage is
recovered later with the same references. Recovery waits ten minutes for an
uncommitted intent and skips locked checkouts. An IMS reservation response in a
later lifetime state never permits placement.

Customer and Staff cancellations commit their decisions before releasing stock.
A scoped `after` task starts release after the response, so an IMS outage cannot
turn a successful cancellation into a timeout. Failed attempts rotate through
recovery in last-attempt order, with a bounded run budget.
Cancelled whole lines retain their original reservation identity. IMS failures
leave retryable work, rather than reopening an Order or losing its reservation.
The follow-up packing slice owns deduction; this ticket does not mark items packed.

The authenticated `/api/cron/stock-reservations` job runs every five minutes via
GitHub Actions, with `CUSTOMER_NOTIFICATION_CRON_SECRET` and `STOREFRONT_URL`.
It cancels unpaid `gcash`, `maya` and `bank-transfer` Orders at age >= 24 hours,
including proof awaiting Staff verification. COD and paid/fulfilled Orders never
expire. An Order row lock prevents expiry from racing a successful payment.
The five-minute cadence is scheduler resolution, not a browser poll; GitHub may
delay scheduled runs. Recovery also drains cancellation releases and the durable
email/audit outbox. The job publishes live invalidations after committed expiry.

Expiry queues “Your order was cancelled” as a generic App email, sent after stock
release. Email and audit queues have separate quotas and failed entries rotate, so an
audit outage cannot starve cancellation emails. The original `Idempotency-Key` is forwarded through the gateway so a
lost acknowledgement does not enqueue another email. Stock audit events use
`order.stock_reserved` and `order.stock_released` with stable per-line keys.
The central audit catalog must accept both actions; failed delivery remains in
the outbox. Verify actual central-service delivery under the live verification
ticket; this PR does not change platform services.

## Packing (epic-crms#338)

Apply the additive `0030_order_packing.sql` migration before deploying this slice.
The internal Order status endpoint now requires validated `staffId` and `staffName`
for `preparing`, and confirms `packedBy: { id, name, at }`. Paid Orders and confirmed
Cash on Delivery Orders can pack; other statuses and missing Delivery fee quotes
are refused. This remains one `preparing` status, with no checklist, photo or batch
selection.

Packing first commits `packing_started_at` while locking the Order, then deducts
active, unreleased reservation lines through IMS with their original immutable
keys. Only after all deductions confirm does it record `packed_at`, the completing
Staff identity and `preparing`. The IMS owns idempotency: retries after a partial
failure or lost reply return the existing deduction without removing stock again.
No available quantity is copied into the storefront. Legacy Orders with no
reservation record attribution without inventing a stock movement.

An unfinished pack blocks Order and item cancellation, including Customer calls.
Refresh and explicitly retry Pack order after restoring IMS; no automatic browser
retry or poll is introduced. Another Staff member can finish recovery and is
recorded as the packer. A finished pack cannot be repeated. Existing cancellation
of preparing Orders/items remains available: only deducted lines use IMS
`add_back`; lines cancelled before packing still use `release`. Both reuse the
same keys through the existing durable release queue.
