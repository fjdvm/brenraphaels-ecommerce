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
