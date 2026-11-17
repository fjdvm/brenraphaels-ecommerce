# Storefront on Azure Container Apps

Code pushes to `main` run typecheck, lint and tests in parallel with one production
image build and push to `ghcr.io/fjdvm/brenraphaels-ecommerce` using the workflow's
`GITHUB_TOKEN`. PRs run validation only. The deploy job uses the immutable digest,
Azure OIDC login and `GHCR_PULL_TOKEN` for private image pulls. It creates
`ca-ecommerce` on its first run in `rg-brenraphaels` / `cae-brenraphaels`, Indonesia
Central. Deploys are serialized and superseded main commits are skipped after acquiring
the deployment lock; failed validation never deploys.

The image has no build arguments. `NEXT_PUBLIC_SITE_URL` is supplied at runtime;
`NEXT_PUBLIC_TURNSTILE_SITE_KEY` is taken from the existing repository variable
and bound at runtime. Changing the key requires a new revision, not an image rebuild.
Code PRs smoke-test the same image shape; docs-only changes skip checks and deploy,
with the always-running `ci-gate` recording success. Main does not repeat smoke tests.
Until the domain is bound, use the default HTTPS address printed in the workflow
summary. The site continues using its existing Cloudflare gateway runtime URLs.
Domain binding and gateway cutover are separate tickets. Existing custom-domain
bindings are preserved on subsequent deploys.

## GitHub settings

Repository secrets for deployment infrastructure:

- `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`: the existing Azure
  application with a federated credential matching this repo's `main` subject.
- `GHCR_PULL_TOKEN`: classic PAT with only `read:packages`. The shared token from
  authentication issue #181 has no expiry; rotate all its consumers together.

Repository variables: `GHCR_USERNAME=fjdvm` and `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
(the Cloudflare `storefront` widget site key, hostnames `shop.buildwrite.me` and
`localhost`, Managed mode).

`.env.production.example` is the complete application key inventory. Each
configured server key is a GitHub repository secret, copied at deploy time into an Azure
Container Apps secret and referenced by the container environment. Never pass
credentials as build arguments, commit env files, print the manifest, enable shell
tracing, or upload manifest artifacts. The renderer creates a private temporary
file (0600); the deploy script deletes it on exit and suppresses ARM responses.
GitHub reserves the `GITHUB_` prefix: store `GITHUB_FEEDBACK_TOKEN` and
`GITHUB_FEEDBACK_REPOSITORY` as `STOREFRONT_GITHUB_FEEDBACK_TOKEN` and
`STOREFRONT_GITHUB_FEEDBACK_REPOSITORY`; the renderer maps these to the original
runtime names. Only inventory keys and the image pull token enter the manifest; Azure login
credentials and unrelated GitHub secrets do not.

Required application secrets:

- Site/process: `NEXT_PUBLIC_SITE_URL` (https://shop.buildwrite.me),
  `NODE_ENV` (production), `NEXT_TELEMETRY_DISABLED` (1), `HOSTNAME` (0.0.0.0),
  `PORT` (3000).
- Storefront: `DATABASE_URL`, `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET`,
  `UNSUBSCRIBE_SECRET`, `CREOMS_SERVICE_SECRET`, `SENIOR_PWD_ID_SECRET`, `CRON_SECRET`,
  `CUSTOMER_NOTIFICATION_CRON_SECRET`, `PRODUCT_IMAGE_ORIGIN`, `TURNSTILE_SECRET_KEY`.
- Careers: `CAREERS_DATABASE_URL`, `CAREERS_NEON_AUTH_BASE_URL`,
  `CAREERS_NEON_AUTH_COOKIE_SECRET`.
- Email: `BREVO_SMTP_HOST`, `BREVO_SMTP_PORT`, `BREVO_SMTP_USER`, `BREVO_SMTP_KEY`,
  `EMAIL_FROM_ADDRESS`, `EMAIL_FROM_NAME`.
- Order assistant (optional): `ASSISTANT_GROQ_API_KEY`, `ASSISTANT_GEMINI_API_KEY`, and optionally `ASSISTANT_GROQ_MODEL`, `ASSISTANT_GEMINI_MODEL`.
- Existing Cloudflare integration: `GATEWAY_URL`, `GATEWAY_CALLER_KEY`,
  `API_GATEWAY_URL`, `API_GATEWAY_CALLER_KEY`.

Other inventory keys are optional and omitted when unset: direct migration URLs,
previous CREOMS signing key, GitHub feedback settings, optional Blob settings,
the Careers Caller key. Unconfigured integrations keep their
existing disabled behavior. Careers applications are saved in the shared database with no outbound delivery
or Vercel Queue. No Vercel deployment configuration is needed.

## Scheduled jobs and legacy files

GitHub Actions calls the existing cron routes with bearer authorization using the
`CRON_SECRET` repository secret and `STOREFRONT_URL` repository variable (set to
`https://shop.buildwrite.me`). The workflows support manual dispatch as well:

- `auto-complete-tickets.yml`: daily at 01:00 UTC.
- `feedback-requests.yml`: daily at 02:00 UTC.
- Existing delivery-photo retention and customer-notification workflows continue
  on their own schedules and use their existing configuration.

There are no Vercel cron entries. Keep `@vercel/blob` and any needed Blob token:
legacy payment-proof and Ticket attachment reads and the catalog import script
still use Blob. New payment-proof uploads use file-storage through the gateway;
existing Blob files are not copied as part of this cleanup.

Feedback reports work without `VERCEL_*` variables: environment falls back to
`NODE_ENV` (or `unknown`), and version falls back to `unknown`. When present,
`VERCEL_ENV`, `VERCEL_GIT_COMMIT_SHA` and `VERCEL_DEPLOYMENT_ID` only label reports;
they are not required Azure secrets.

## Provisioning secrets

Before provisioning or rotating secrets from the owner's local env files, get the
owner's approval. Send values to `gh secret set KEY` through stdin without echoing
them. This rollout used approved `.env.production` values with existing `.env`
fallbacks for gateway, image, cron and CREOMS settings. Set the canonical public
URL and process settings as above. An unset required secret fails before Azure is
changed; optional values are never sent as empty Azure secrets.

## Verify and roll back

The app runs 1–2 replicas, each 0.5 vCPU / 1 GiB, HTTPS ingress to port 3000.
Startup, readiness and liveness probes call the DB-independent `/api/health`.
Deployment waits for the exact new revision to be Healthy and latest-ready, then
checks the public default address. The workflow summary records the FQDN, revision
and image digest. Health confirms process readiness; the CI smoke checks cover
catalog rendering, images and cron authorization against disposable services.

Single-revision mode leaves the old revision serving until its replacement is
ready, then retains up to ten inactive revisions. No schema change or database
migration is part of this deployment. For future schema changes, apply compatible
migrations using the repo's Drizzle migration process before deployment.

List retained revisions (no secret values):

```sh
az containerapp revision list --all -g rg-brenraphaels -n ca-ecommerce \
  --query '[].{name:name,active:properties.active,health:properties.healthState,image:properties.template.containers[0].image}' -o table
```

To roll back, copy the chosen retained revision into a new revision (substitute an
actual name from the table). This preserves single-revision mode and the normal
readiness gate rather than changing traffic mode:

```sh
az containerapp revision copy -g rg-brenraphaels -n ca-ecommerce \
  --from-revision ca-ecommerce--gh-RUN-ATTEMPT \
  --revision-suffix rollback-$(date +%s) --output none
az containerapp show -g rg-brenraphaels -n ca-ecommerce \
  --query '{ready:properties.latestReadyRevisionName,address:properties.configuration.ingress.fqdn}'
curl --fail https://DEFAULT-ADDRESS/api/health
```

Wait for the copied revision to become Healthy and latest-ready as above. Secrets
are app-scoped: restoring a revision does not restore older secret values. Rotate
or restore those separately with approval. Revert the bad commit on `main` for a
permanent fix; a later push deploys the current code again.

## Turnstile verification

Sign-up (the final step), forgot-password, and verification-email resend display
Cloudflare Turnstile. Every action verifies `cf-turnstile-response` with Siteverify
before rate limiting, field validation, database work, or email sending. Missing,
invalid, expired or reused tokens and verification outages return the existing
form error shape and ask the visitor to retry. Challenges renew after submissions.
The secret is required by the deployment renderer and reaches the container only
through an Azure secret reference; never pass it as a build argument.

For local testing, set `NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA`
and `TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA` (always pass), or
`TURNSTILE_SECRET_KEY=2x0000000000000000000000000000000AA` (always fail).
Use the dummy token `XXXX.DUMMY.TOKEN.XXXX` for server tests. CI smoke containers use
the public test site key; production containers use the repository variable and the
production runtime secret. Never configure test keys in production.
See [Cloudflare's test keys](https://developers.cloudflare.com/turnstile/troubleshooting/testing/)
and [server verification](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/).
