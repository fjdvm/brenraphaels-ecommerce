# Order-placed signal to CREOMS

Implements [CREOMS #246](https://github.com/fjdvm/epic-crms/issues/246), part of [#243](https://github.com/fjdvm/epic-crms/issues/243).

After checkout commits an Order, the storefront schedules one `POST /creoms/notifications/signal` through Next's `after()`. It uses the existing `API_GATEWAY_URL` and `API_GATEWAY_CALLER_KEY` for the storefront's Caller and sends only `{ "kind": "Order" }`. All Fulfillment methods and Payment methods take the same path. No Customer details, Order id, alert contents or recipients leave the storefront in this signal.

The gateway accepts only the storefront Caller and forwards an empty signal to CREOMS. CREOMS discovers committed Orders from the shared database and decides which Staff see each alert. The signal never creates an alert from supplied event data.

The signal runs after the checkout response, with the gateway helper's five-second timeout. HTTP failures, network errors, timeouts and missing gateway configuration are logged and swallowed. They cannot undo the Order, refill the Cart, change the checkout response or prevent the confirmation email. A failed Order schedules no signal; a failed email still allows it.

Signals are best effort: there is no retry or outbox. CREOMS's existing five-second browser poll continues to run its sync and find committed Orders when a signal is lost. This change does not change CREOMS polling, ledger or read state.

Deploy the gateway route from [proxy PR #12](https://github.com/fjdvm/brenraphaels-proxy/pull/12) and CREOMS receiver from [CREOMS PR #268](https://github.com/fjdvm/epic-crms/pull/268), including its migration and matching signal secret, before expecting instant alerts. The Staff browser's live nudge handling is [#247](https://github.com/fjdvm/epic-crms/issues/247). No new storefront environment variable or database migration is needed.

`__tests__/gateway-order-placed.test.ts` drives checkout against throwaway Postgres with gateway fetch stubbed. It covers the kind-only authenticated request after checkout returns, all four method combinations, gateway/CREOMS/network/configuration failure, committed Order and emptied Cart after signal loss, no signal for a failed Order, and sending despite a failed email.

## Remaining Staff signals (#251)

After each successful action, the storefront uses the same authenticated signal
route with only a kind:

| Event | Kind |
| --- | --- |
| Customer email verified (token accepted once) | `Customer` |
| GCash Payment proof saved | `Payment` |
| Ticket opened or Customer Message saved | `Ticket` |
| Feedback saved with 1–3 stars | `Feedback` |
| Return requested | `Return` |

`lib/notifications/staff-signal.ts` schedules these calls through `after()` and
catches both scheduling and delivery faults. Failed actions, invalid/expired
verification, and 4–5-star Feedback send nothing. Uploading Return evidence or
cancelling a Return sends nothing. The initial Ticket Message shares the Ticket's
one signal. No new credentials, migration, alert rules or Module permissions are
needed. The gateway still strips the kind before CREOMS discovers events in SQL.

`__tests__/gateway-staff-signals.test.ts` drives the actions and Return HTTP route
with gateway fetch stubbed. It verifies one authenticated kind-only signal per
event, deferred sending, failed-action exclusions, the Feedback threshold, and
HTTP/network/configuration/scheduling failure isolation. Production latency still
requires the deployed receiver, live bell and gateway configuration described
above; the five-second poll covers a lost signal.
