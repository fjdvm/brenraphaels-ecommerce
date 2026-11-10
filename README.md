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

### Writing database-backed tests

Get a fresh, migrated, isolated database from `__tests__/helpers/test-database.ts`
instead of building a `PGlite` and running the migrator yourself. Vitest's
`globalSetup` (`__tests__/helpers/migrated-snapshot.ts`) migrates once per run and
snapshots the result to the OS temp directory; each call loads its own copy, so
test time does not grow with the number of migrations. Measured full `npm test`
on one 8-core machine: 415.8 s before the snapshot (`7dd420b`), 190.0 s after
(`78d5f82`), about 2.2x faster.

**Watch mode caveat:** the snapshot is built once when the run starts. After you
add a migration, restart `npm run test:watch`, or tests keep using the old schema.
`npm test` rebuilds it every run, so it is always current.

## Deployment

The storefront runs on **Azure Container Apps**, using a standalone Next.js Node
server. Pushes to `main` build the image, run checks and deploy through GitHub
Actions. See the [Azure deployment guide](docs/azure-deployment.md) for secrets,
configuration and rollback, and the [container guide](docs/container.md) for local
builds and smoke tests.

GitHub Actions calls the scheduled routes; no Vercel deployment or `vercel.json`
is required. `@vercel/blob` remains for legacy file reads and the catalog import
script. New payment-proof uploads use file-storage.
