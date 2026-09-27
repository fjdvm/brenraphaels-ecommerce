# Abuse controls

Refs #11. No CAPTCHA is used anywhere; every control below is invisible to
customers.

## BotID (in code)

BotID is wired in three places:

- `next.config.ts` wraps the config in `withBotId` so the BotID challenge script
  is proxied from our own origin.
- `instrumentation-client.ts` calls `initBotId` for `POST` requests to
  `/signup`, `/forgot-password`, `/verify-email` and `/signin`. `/signin` is
  listed only because its page also renders the verification-resend form; the
  sign-in action itself is not checked.
- The server actions `submitSignUp`, `submitForgotPassword` and
  `resendVerificationEmail` call `hasValidBotIdCheck()`
  (`lib/security/botid.ts`) before they validate input or do any work. A request
  without a valid check gets "Please try again from your browser." and triggers
  no sign-up, password-reset email or verification email.

`__tests__/botid-server-actions.test.ts` covers the server refusing an unchecked
request for all three actions.

BotID only classifies traffic on Vercel deployments; locally `checkBotId()`
reports no bot.

## Resend cooldown (in code)

An email can receive one verification resend every 60 seconds
(`resendCooldownSeconds` in `lib/customer/email-verification.ts`), enforced in
the database by `lib/customer/verification-resend-store.ts` and covered by
`__tests__/customer-email-verification.test.ts`. This is independent of BotID
and the Firewall rule.

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

## BotID and the proxy

Basic BotID needs no dashboard setting; the code above is all it takes. The
optional **Vercel BotID Deep Analysis** toggle (Project → Firewall → Rules) does
not appear on the Hobby plan and is not used. The dashboard's separate **Bot
Protection** ruleset is a different feature and stays Off.

`withBotId` serves the challenge script under
`/149e9513-01fa-4fb0-aad4-566afd725d1b/…`. `proxy.ts` must not redirect that
path for signed-out Visitors, or the script never loads and no form submission
carries a BotID check. The proxy matcher excludes it, covered by
`__tests__/proxy-matcher.test.ts`.

## Go-live checklist

- [x] Rate-limit rule created and verified (see above).
- [ ] On the deployed site, confirm a signed-out Visitor loads the challenge
      script (200, JavaScript) and that a real sign-up, password reset and
      verification resend each succeed.
- [ ] Submit the sign-up form more than 10 times in a minute and confirm the
      rule blocks the IP.
