# Product images

Refs fjdvm/epic-crms#230 (parent #226).

IMS owns the Public, Permanent image Files. `product_images.file_id` holds their
opaque File ids. `url` retains the old Blob address during migration; a row with
no File id still uses that address and does not need the gateway configured.
Catalog, Cart and Order history reads prefer the File id when both references exist.
Cart and Order thumbnails fall back to the retained Blob address (or no image)
on a resolution failure, so image availability cannot fail a purchase or a
committed Order change.

Set `API_GATEWAY_URL`, `API_GATEWAY_CALLER_KEY` and `PRODUCT_IMAGE_ORIGIN` before
adding File ids. `PRODUCT_IMAGE_ORIGIN` is an HTTPS origin with no path, such as
`https://pub-example.r2.dev`. It controls both the returned image host and
Next's allowed remote image host. Gateway metadata supplies the object path.
Only Active, Public, Permanent image Files are accepted; gateway refusals and
invalid Files are not cached. Private signed addresses are never exposed here.

Addresses use Next's persistent Data Cache for one year, with a separate tag
per Product. Product descriptions, prices and availability are not cached by
this change. The app currently uses the Data Cache without Cache Components,
so this uses `unstable_cache` rather than enabling Cache Components app-wide.

After replacing an image, a trusted Server Action or Route Handler can call:

```ts
import { refreshProductImages } from "@/lib/catalog/product-images";

refreshProductImages(productSlug);
```

This expires every cached address for that Product immediately, so its next
read waits for a fresh resolution. Other Products stay cached. There is no
public invalidation endpoint. A host configuration change also changes the
cache key; redeploy after changing the origin so Next reloads its allowlist.

Migration `0022_product_image_files.sql` adds the nullable File id and permits
File-only rows. Existing Blob references are preserved. Apply this migration
before deploying the application. The one-off Blob copy is separate work.

Tests use PGlite, a fake gateway and Next's real in-memory Data Cache; they do
not contact Neon, R2 or Vercel. For rollout verification, resolve a known Public,
Permanent Product File through the deployed gateway, read its Product twice,
then replace it and call the refresh function from a trusted server context.
Check the next read shows the replacement and the returned origin is allowed
by the image component.

## Copy existing Blob product images (fjdvm/epic-crms#236)

Run the one-off copy from a trusted local shell with Node 22.18+ (or Node 24+).
It uses the existing `0022_product_image_files.sql` schema; **no new schema
migration is needed**. Apply 0022 first if it has not yet been applied to the
target database. This command does not apply schema migrations itself.

The command loads the git-ignored `.env.production` file when present, following
`catalog:import`. Check that it points to the intended database before running.
Set `DATABASE_URL_UNPOOLED` (preferred) or `DATABASE_URL`. For an actual copy,
also set `API_GATEWAY_URL`, `API_GATEWAY_CALLER_KEY` and
`PRODUCT_IMAGE_ORIGIN`. Use a direct database connection where possible: each
copy holds a row lock through its network work, so concurrent script runs
cannot copy the same row twice. No Vercel API access or Blob write token is
needed: the retained **public** Blob address is the download source.

```sh
# Read rows and list planned copies; no downloads, gateway calls or database writes.
npm run catalog:images:migrate -- --dry-run

# Copy, verify and fill in file_id; leaves url, alt and position unchanged.
npm run catalog:images:migrate -- --apply
```

Omitting flags also performs a dry run. Unknown or conflicting flags are refused.
Output is JSON Lines: `planned`, `skipped`, `copied`, or `failed`, followed by
summary counts. Any failed row gives the process a nonzero exit status; later
rows are still attempted. Empty catalogs are a successful no-op. Rows already
holding a File id, including File-only rows, are skipped without contacting
Blob or file-storage.

Each pending row must reference an HTTPS public Vercel Blob address. The script
reads at most 25 MiB, rejects empty or unsupported originals, and detects JPEG,
PNG/APNG, GIF or WebP from their bytes rather than trusting the response's MIME
header. It requests a Public Permanent File through the gateway with an IMS
Product Link (`entityType: product`, `entityId: product_slug`, `role: image`),
uploads the original to the signed PUT address without the gateway credential,
and confirms it. It then checks Active/Public/Permanent metadata and downloads
the original from the configured public image host to compare SHA-256 hashes.
Only after verification does the transaction set `file_id`. No Blob object is
deleted, and **the Blob address is always retained for rollback**. The product
read path added in #230 then prefers the File id; new File ids produce new cache
keys without needing a Next request from this standalone script.

A failure rolls back the row and removes any newly created, unreferenced File.
If a commit response is lost, the script re-reads the row before considering
removal: a persisted reference counts as copied and is never deleted. If cleanup
or that reconciliation read fails, the failure report includes `fileId` and
`cleanupError`; inspect that File and the row before retrying or deleting it.
Do not blindly delete a File whose database write is uncertain. A process killed
between external service calls cannot perform cleanup; inspect storage audit
records and Product Links for unreferenced copies before rerunning after such an
interruption. Ordinary successful reruns skip copied rows; retries after a
cleanly handled failure create a single replacement after the rejected copy has
been removed.

For rollout, review the dry-run list, apply against the intended database, check
that the summary has zero failures, and rerun to confirm all rows are skipped.
Open migrated Products through the deployed storefront and verify the configured
public image host loads. Keep Blob objects until those checks pass; deleting
legacy Blob objects or removing `url` is outside this script's scope. The
migration tests use real PGlite transactions and fake HTTP Blob, gateway and
object-storage responses; they never access live Neon, Vercel or R2.
