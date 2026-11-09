# Storefront container

Build with Docker (Node 24, standalone Next.js server):

```sh
docker build --build-arg NEXT_PUBLIC_SITE_URL=https://shop.example.com \
  --build-arg NEXT_PUBLIC_TURNSTILE_SITE_KEY=YOUR_PUBLIC_SITE_KEY -t storefront:local .
docker run --rm --env-file .env.production -p 3000:3000 storefront:local
```

Use `.env.production.example` as the key inventory. Supply DATABASE_URL,
NEON_AUTH_BASE_URL and NEON_AUTH_COOKIE_SECRET at runtime for the storefront;
configure the listed integration keys for the features you enable. The Careers
portal uses its own database and Auth keys. Never include real env files in the
build context. The public site URL and Turnstile site key are build arguments. The site URL
must also be supplied at runtime for server-generated email links. Supply
TURNSTILE_SECRET_KEY only at runtime. For disposable smoke builds, use Cloudflare's
public test site key `1x00000000000000000000AA`; the smoke runner supplies the
matching test secret, never a production credential.

The image runs as the unprivileged Node user, listens on 0.0.0.0:3000, and exposes
`/api/health` for process liveness without a database or Auth request. Override
PORT for the hosting platform. The native sharp dependencies, public assets and
Next static assets are included in the standalone output.

Next serializes its image allowlist at build time. `prepare-server.mjs` inserts
startup configuration into the generated standalone server so PRODUCT_IMAGE_ORIGIN
remains a runtime value with the same HTTPS-origin restrictions as the app. It
fails the image build if Next changes that insertion point; check this when
upgrading Next. Normal Vercel builds continue to use next.config.ts directly.

Run `CONTAINER_IMAGE=storefront:local bash scripts/container/run.sh` after building.
It creates disposable PostgreSQL, applies the existing migrations there, seeds a
catalog product, proves health with an unreachable database, then checks the home
page, optimized local and remote product images and rejected/authorized cron requests.
The file-metadata gateway is a local fixture; its remote image is Google’s public
WebP sample at www.gstatic.com, so that check requires outbound HTTPS. It removes
its containers and network on exit. No production database is used or migrated.

The Storefront container workflow runs type checking, lint, the unchanged test
suite, image build and these smoke checks for PRs and main. It records the
uncompressed image size and rejects images at or above 400 MiB. It builds and
checks main, then publishes and deploys the production image to Azure (see
[Azure deployment](./azure-deployment.md)).
