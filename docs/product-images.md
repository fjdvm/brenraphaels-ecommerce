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
