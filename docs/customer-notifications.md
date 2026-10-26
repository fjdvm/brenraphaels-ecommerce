# Customer Notification delivery

Marking an Order delivered saves one `order.delivered` Notification in the same
transaction as its status, Delivery photo and Delivered at time. It belongs to
that Order's Customer and describes the 24-hour Refund window and early closure
when the Customer marks the Order received. Existing Orders are not backfilled.

The status route attempts delivery after the Customer email. The gateway request
uses `sendingApp: ecommerce`, `targetApp: ecommerce`, the Customer's id in
`userIds`, and `idempotencyKey: order.delivered:<order id>`. Its link opens
`/profile/orders?order=<order id>` on `NEXT_PUBLIC_SITE_URL`.

A successful response marks the stored Notification accepted. Errors and ambiguous
timeouts leave it pending. An authenticated GitHub Actions scheduled call to
`/api/cron/customer-notifications` retries pending Notifications every five minutes;
`CUSTOMER_NOTIFICATION_CRON_SECRET` must be configured. Each run attempts up to
ten pending Notifications within a 60-second function limit. One failed send does not stop the next. Retries
never resend the email or alter the Order. Concurrent attempts use the same key;
the notifications service must enforce uniqueness per sending App, target App,
Customer and key, without pushing duplicates or resetting read state.

Deployment order for epic-crms#245:

1. Apply notifications migration `0004_notification_idempotency` and deploy its
   optional `idempotencyKey` contract before enabling this storefront sender.
2. Apply storefront migration `0024_customer_notification_outbox` before deploying
   this code. It adds only an empty table; it does not rebuild history.
3. Configure the existing gateway credentials, `NEXT_PUBLIC_SITE_URL` and
   `CUSTOMER_NOTIFICATION_CRON_SECRET`. The `customer-notifications.yml` workflow
   uses the `STOREFRONT_URL` repository variable (shared with Delivery photo
   retention) and its own `CUSTOMER_NOTIFICATION_CRON_SECRET` Actions secret.
   Its five-minute schedule runs on the default branch and may
   be delayed by GitHub. Vercel Hobby allows only daily cron jobs, so this retry
   schedule lives in GitHub Actions.

The existing computed Notifications page is replaced by a separate ticket. This
slice delivers to the notifications service inbox and its existing live push path.

Remaining Customer Notifications (epic-crms#253):

- Confirming a Delivery Order stores `order.delivery-fee`. Confirming any GCash
  Order (including a Pickup checkout) also stores `order.payment-needed`.
  Submitting Payment proof does not ask for payment again.
- Dispatch and cancellation store `order.dispatched` and `order.cancelled`.
  Preparing stores nothing. Each key is `<type>:<order id>`.
- Return requests and Staff decisions retain their existing wording and Order
  links, but now store `return.<status>:<return id>` with the change. Email and
  Notification delivery are independent; retrying a Notification never resends email.
- A Staff Message stores `ticket.reply:<message id>` through an AFTER INSERT
  trigger, including Messages written by CREOMS. The trigger runs with its
  owner's privileges and an empty search path, so the restricted CREOMS writer
  needs no access to the outbox. Each reply links to `/support/<ticket id>`;
  Tickets without a Linked order are supported. Customer Messages store none.
- Recording a successfully emailed Feedback request atomically stores
  `feedback.request:<order id>`. The existing once-per-Order ledger and exclusion
  of Orders with Feedback remain in effect. A Notifications outage leaves only
  the Notification pending and does not repeat the email on the next job.

Apply migration `0025_remaining_customer_notifications` before deploying this
sender. It permits a null Order on Ticket Notifications and installs the reply
trigger; it does not backfill historical Messages. Use the existing scheduled
outbox retry for all kinds, including Customer cancellations, Pickup checkouts
and Ticket replies. Internal Order updates and Return notices also attempt an
immediate send; failures remain pending for the scheduled retry.
