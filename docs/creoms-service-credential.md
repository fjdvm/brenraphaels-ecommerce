# CREOMS service credential

Guards `POST /api/internal/orders/<id>/status` (ADR-0003). Anything without a valid credential gets `401` and changes nothing. The old `ORDER_STATUS_API_SECRET` and `X-Order-Status-Secret` header no longer work.

## How CREOMS obtains it

CREOMS holds the signing key `CREOMS_SERVICE_SECRET` (same value as this app's env var) and mints its own short-lived token per call or per few minutes. Nothing is fetched from this app.

An HS256 JWT sent as `Authorization: Bearer <token>`, with claims:

| Claim   | Value                                               |
| ------- | --------------------------------------------------- |
| `iss`   | `creoms`                                            |
| `aud`   | `brenraphaels-orders`                               |
| `scope` | `orders:status`                                     |
| `iat`   | now (Unix seconds)                                  |
| `exp`   | `iat` + at most 900 seconds (15 minutes)            |

Tokens issued in the future, expired, with another audience or scope, or living longer than 15 minutes are refused. `mintCreomsCredential` in `lib/orders/creoms-credential.ts` is the reference implementation.

Set `CREOMS_SERVICE_SECRET` in this app's environment **before** deploying: with it unset (or shorter than 32 characters) every call is refused with `401`. Hand the key to CREOMS over a secure channel (a password manager or similar), never by email or chat.

## Rotating the key

1. Generate a new key: `openssl rand -base64 48`.
2. In Vercel, move the current `CREOMS_SERVICE_SECRET` value to `CREOMS_SERVICE_SECRET_PREVIOUS` and set `CREOMS_SERVICE_SECRET` to the new key. Redeploy.
3. Give CREOMS the new key and have it sign with it. Both keys are accepted meanwhile.
4. Once CREOMS only signs with the new key (tokens last 15 minutes at most), remove `CREOMS_SERVICE_SECRET_PREVIOUS` and redeploy.

If the key leaks, do steps 1–2 without setting `PREVIOUS`; every old token is refused immediately. Keys shorter than 32 characters are ignored.

## Marking an Order paid

Send the Staff member's identity with a `paid` status request:

```json
{ "status": "paid", "staffId": "staff-17", "staffName": "Ana de la Cruz" }
```

Both fields are required, nonblank strings of at most 256 characters. The id is opaque
(no Staff table or foreign key); whitespace and angle brackets are rejected. The name
accepts letters, spaces, apostrophes, hyphens and periods. Surrounding whitespace is
trimmed; the name's casing is retained as a snapshot. Invalid or missing attribution
returns `400` without changing the Order or sending an email. The storefront records
the time; callers cannot supply it.

The returned Order includes `paidById`, `paidByName` and `paidAt` (an ISO timestamp).
CREOMS can also read `orders.paid_by_id`, `orders.paid_by_name` and `orders.paid_at`
(`timestamptz`) through its read-only role. These values persist through later status
changes. All three are null for Orders marked paid before this feature and for Orders
that have never been marked paid. Other status requests neither require nor record
Staff attribution; any supplied `staffId`/`staffName` is ignored.

Apply migration `0018_daffy_peter_quill` before deploying this code. It adds nullable
columns without backfilling legacy Orders.
