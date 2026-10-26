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
