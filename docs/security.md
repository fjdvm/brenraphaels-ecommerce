# Abuse controls

Refs #11.

## BotID (removed)

BotID is a Vercel product and cannot run on Azure, so it was removed (#189).
Sign-up, password reset and verification resend currently have no bot check;
protection returns with the rate-limit and Turnstile tickets of #180.

## Resend cooldown (in code)

An email can receive one verification resend every 60 seconds
(`resendCooldownSeconds` in `lib/customer/email-verification.ts`), enforced in
the database by `lib/customer/verification-resend-store.ts` and covered by
`__tests__/customer-email-verification.test.ts`. This is independent of the Firewall rule.

## Rate-limit rule (Vercel Firewall, live)

The rule exists and is enabled on the `brenraphaels` project. Verified on
2026-09-27 with `vercel firewall rules inspect
rule_protect_auth_form_submissions_NFz6MD` and in the dashboard (Project →
Firewall → Rules). It is a dashboard/API setting, not committed config, so
recreate it from this table if the project is ever rebuilt:

| Field          | Value                                              |
| -------------- | -------------------------------------------------- |
| Name           | Protect auth form submissions                      |
| Condition      | Method is `POST` and path is one of `/signup`, `/signin`, `/forgot-password`, `/verify-email` |
| Rate limit     | Fixed window, 60 seconds, 10 requests              |
| Key            | IP address                                         |
| When exceeded  | Deny (or 429) for 15 minutes                       |

Server actions are `POST`s to the page path, so this covers sign-up, password
reset, the resend action and password guessing on `/signin`.

## Go-live checklist

- [x] Rate-limit rule created and verified (see above).
- [ ] On the deployed site, confirm a signed-out Visitor loads the challenge
      script (200, JavaScript) and that a real sign-up, password reset and
      verification resend each succeed.
- [ ] Submit the sign-up form more than 10 times in a minute and confirm the
      rule blocks the IP.
