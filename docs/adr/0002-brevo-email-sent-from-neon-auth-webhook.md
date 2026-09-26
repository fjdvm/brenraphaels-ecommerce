# Brevo email is sent from our Neon Auth webhook, not Neon's SMTP setting

Verification and password-reset emails go out through Brevo SMTP. Neon Auth can send email itself (its shared sender, or a custom SMTP provider for the sender address only), but its documentation gives no SMTP host, port or credential settings, and link-style verification is only documented for a custom email provider. So we subscribe to Neon's blocking `send.magic_link` webhook, verify its signature against the JWKS at `<NEON_AUTH_BASE_URL>/.well-known/jwks.json`, and send a branded HTML email ourselves with nodemailer over Brevo SMTP. We rejected Neon's built-in SMTP setting because we could not confirm it works with Brevo and it gives no control over the template or the link target.

## Consequences

- Webhooks are configured per Neon branch and must point to a public HTTPS URL (localhost is rejected), so the `production` branch targets the production domain, the `dev` branch targets a stable Vercel preview URL, and testing email locally needs a tunnel.
- `send.*` webhooks are blocking: if all three delivery attempts fail or the 15-second limit passes, sign-up or password reset fails for the Customer. Our webhook route must be fast and must fail loudly.
- Neon offers no test events or redelivery for webhooks.
- Fallback if link payloads turn out not to suit us: the `send.otp` event delivers a 6-digit code through the same route.
- Neon refuses `link` verification while the branch uses its shared email provider, even though our webhook does the sending. Each Neon branch therefore also needs Brevo set as its custom SMTP provider (same host, port, credentials and sender as the Vercel `BREVO_*` and `EMAIL_FROM_*` variables). Neon then sends nothing itself for `send.magic_link`.
- Settings each Neon branch needs for this flow (Neon Console, Settings, Auth): the webhook enabled with our route's URL, only the `send.magic_link` event and a timeout of 10 seconds; Verify at Sign-up on; verification method `link`; email verification required. Check with `get_neon_auth_config`, which does not show the webhook.
- The Neon SDK's `verifyEmail` POSTs to `/verify-email`, which Neon answers with a 404; only GET works. `lib/neon-auth/verify-email.ts` calls it directly and passes Neon's session cookies on, so a verified Customer is signed in.
- Before launch, turn off "Allow Localhost" on the `production` Neon branch. It is on for development and weakens security in production.
