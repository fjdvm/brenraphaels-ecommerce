Public storefront foundation for Bren Raphael's Ube Jam & Halaya.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Database migrations

Drizzle uses `DATABASE_URL_UNPOOLED` so schema changes run over Neon's direct, non-pooled connection. Copy `.env.production.example` to `.env.local` and set that value before running migrations.

```bash
npm run db:generate # create a migration after editing lib/db/schema.ts
npm run db:migrate  # apply migrations
npm test            # includes an in-memory PGlite migration harness
```

## Deployment

The storefront runs on **Azure Container Apps**, using a standalone Next.js Node
server. Pushes to `main` build the image, run checks and deploy through GitHub
Actions. See the [Azure deployment guide](docs/azure-deployment.md) for secrets,
configuration and rollback, and the [container guide](docs/container.md) for local
builds and smoke tests.

GitHub Actions calls the scheduled routes; no Vercel deployment or `vercel.json`
is required. `@vercel/blob` remains for legacy file reads and the catalog import
script. New payment-proof uploads use file-storage.
