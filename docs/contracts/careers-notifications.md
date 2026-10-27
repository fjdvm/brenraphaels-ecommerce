# Careers Notifications contract

Careers' notifications App is `careers`, separate from the storefront's
`ecommerce` App. App names are text namespaces in the notifications service;
there is no App registration table or schema migration.

## Gateway registration

Add a dedicated Caller to the gateway's existing `CALLERS` secret, preserving
all existing entries:

```json
{ "name": "careers", "app": "careers", "keyHash": "<SHA-256 hex of the Careers Caller key>" }
```

Store the raw key only in the Careers backend's
`CAREERS_API_GATEWAY_CALLER_KEY` environment variable. Use the existing
`API_GATEWAY_URL`. Never reuse `API_GATEWAY_CALLER_KEY` (the storefront key),
expose either key to a browser, or change the HRMS Caller's App mapping.
The existing HRMS Caller remains `hrms` (its App defaults to its Caller name).
No notifications Worker deployment is needed to accept `careers`.

The gateway authenticates a backend Caller; it does not authenticate individual
Applicants. Careers must derive every recipient id from its own Neon Auth
session. `lib/careers/inbox.ts` does this for list, unread count, mark one read
and mark all read, rejects signed-out requests, and never accepts a recipient
id as input. HRMS may send Notifications to Careers as its own Caller.

## HRMS #37: announce a new Open Job Posting

Send `POST /notifications/notifications` through the gateway, authenticated
with the **HRMS** Caller key. For example:

```json
{
  "sendingApp": "hrms",
  "targetApp": "careers",
  "userIds": ["<Applicant Neon Auth user id>"],
  "type": "job-posting.opened",
  "title": "New Job Posting: Production Baker",
  "body": "Applications are now open for Production Baker. View the Job Posting to apply.",
  "link": "https://<Careers host>/careers/<Job Posting id>",
  "idempotencyKey": "job-posting.opened:<Job Posting id>"
}
```

- `userIds` contains the Applicant's Careers Neon Auth user id, identical to
  `applicant_profiles.applicant_id`. Never send an email address, Application
  Reference number, storefront Customer id or HRMS Staff id.
- Notify **every registered Applicant**, including signed-out and unverified
  Applicants and those with `job_alerts_opt_in = false`. Email opt-in controls
  email only; it never filters the in-app audience.
- Send only for a newly Open Job Posting. Both title and body name its role.
  Use an absolute HTTPS link to `/careers/<id>` on Careers' public host, with
  the actual Job Posting id used by the Careers detail route.
- Use a stable event key across retries. The service deduplicates by sending
  App, target App, recipient and key. Do not generate a new key on retry or
  reset existing read state. Record the Job Posting's announcement marker
  only after the announcement work has succeeded; retry partial failures
  using the same key.
- App email is a separate `POST /notifications/emails/app` with `app: "careers"`,
  sent as HRMS only to Verified Applicants who opted in. It does not replace
  the stored in-app Notification.

The inbox reads the newest 50 stored Notifications in the service's descending
creation order. Every HTTP request scopes to `app=careers` and the signed-in
Applicant's id. Mark-one also supplies both values, so the service returns 404
for another Applicant's Notification or a Notification from another App.
Mark-all affects only that same recipient/App pair. Errors propagate to the
caller so a later UI can offer retry; they are never reported as successful
reads. The bell and inbox keep current through the gateway's live line: the server
issues a short-lived pass for the signed-in Applicant only, and the browser
refetches the inbox on every connect and on each created or read event.

## Registration verification (#173)

The gateway Caller `careers` is provisioned with `app: "careers"`, and
`CAREERS_API_GATEWAY_CALLER_KEY` is stored as a Vercel Production secret for
`brenraphaels`. The next production deployment receives it. A live gateway
ticket verified the App claim as `careers`; list and unread-count requests for
a synthetic recipient both returned HTTP 200 (empty list, zero unread).
The existing storefront and HRMS Caller credentials still authenticate with
their original App claims. No Notifications were created by these checks.

Production credentials do not configure local or Preview environments. Provision
a dedicated credential there before testing against a live gateway; the inbox
service tests supply their own HTTP gateway and require no credentials.
