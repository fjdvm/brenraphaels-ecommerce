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

## Rate-limit rule (Vercel dashboard, not yet applied)

Not verified: when this ticket was implemented the Firewall API for the
`brenraphaels` project returned 403 for the available credentials, so the rule
could not be created or read back. It is a dashboard/API setting, not committed
config. Create it under **Project → Firewall → Rules** during "Production
go-live":

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

- [ ] Enable BotID (and Deep Analysis if available) for the project:
      **Project → Firewall → Rules**, after a deployment containing this code.
- [ ] Create the rate-limit rule above and confirm it with `vercel firewall`
      or the dashboard.
- [ ] From a deployed preview, submit the sign-up form more than 10 times in a
      minute and confirm the rule blocks the IP.
