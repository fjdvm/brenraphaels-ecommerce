# Delivery photo retention

Implements fjdvm/epic-crms#235 (parent #226).

The daily GitHub Actions workflow calls `GET /api/cron/delivery-photo-retention`
with `Authorization: Bearer <CRON_SECRET>`. Set the repository Actions variable
`STOREFRONT_URL` to the deployed storefront's HTTPS origin and the Actions secret
`CRON_SECRET` to the same secret configured in the storefront environment.
`workflow_dispatch` also permits a manual catch-up run.

Apply migration `0023_delivery_photo_retention` before deploying this code.
It adds `orders.received_at` and `orders.delivery_photo_removed_at` without
inventing a receipt time for historical Orders. Historical received Orders with
no known receipt time retain their photos; historical delivered Orders without
a delivery time do too.

The job removes photos at seven days after receipt, or at eight days after
delivery for Orders never received. Requested, Approved and Goods received
Returns hold the photo until they are decided. A decided Return does not restart
the timer: an overdue photo is removed on the next run.

The job locks each Order and rechecks eligibility. Customer receipt and Return
creation use the same lock. file-storage's existing `DELETE /files/:id` removes
the file objects and is safe to repeat. Only successful deletion (including an
already absent File) clears the Order's File id and records removal. The Order
store exposes `deliveryPhotoRemovedAt` for the removal-message UI follow-up.
No file-storage change is required.

A failure leaves the Order unchanged for retry, logs the failed Order, and lets
other Orders proceed. The route returns `{ removed, failed }` and HTTP 500 if any
photo failed, so the workflow reports failures and retries. Never log the secret.

Before enabling the schedule, verify the protected deployed endpoint with the
configured secret after the migration, and confirm a missing secret returns 401.
Tests use in-memory Postgres and a fake file deletion boundary, never real files.
