# Abuse controls

Refs #11.

## BotID (removed)

BotID is a Vercel product and cannot run on Azure, so it was removed (#189).
Sign-up, password reset and verification resend use the in-process rate limit
below. Turnstile is still pending under #180.

## Auth form rate limit (Azure)

`lib/customer/auth-rate-limit.ts` permits five attempts per client address per
action in a fixed ten-minute window, including invalid submissions. The sixth
attempt returns the form's existing error shape with a friendly retry message.
Each action has its own allowance. The next attempt at or after window expiry
starts a fresh allowance.

Only Azure Container Apps' rightmost `X-Forwarded-For` address is trusted;
client-supplied prefixes and `X-Real-IP` cannot bypass the limit. Missing or
invalid addresses share a fallback bucket. IPv6 spellings are normalized.
See [Azure ingress headers](https://learn.microsoft.com/en-us/azure/container-apps/ingress-overview).

This is an in-memory demo control for one running instance: restarts clear the
allowances, and replicas do not share them. Expired entries are removed on the
next attempt. No database migration is needed. Action tests cover expiry and
isolation; container HTTP smoke tests cover the three refused actions.

## Resend cooldown (in code)

An email can receive one verification resend every 60 seconds
(`resendCooldownSeconds` in `lib/customer/email-verification.ts`), enforced in
the database by `lib/customer/verification-resend-store.ts` and covered by
`__tests__/customer-email-verification.test.ts`. This is independent of the Firewall rule.

## Legacy rate-limit rule (Vercel Firewall)

This rule was enabled on the `brenraphaels` project. Verified on
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

This rule applies only to the old Vercel deployment, not Azure. Server actions
are `POST`s to the page path, so it covered sign-up, password
reset, the resend action and password guessing on `/signin`.

## Go-live checks

Container CI checks that all three actions refuse attempt six. After deploy,
confirm a real sign-up, password reset and verification resend succeed. Once
Turnstile is added, also confirm its challenge loads on the deployed site.
