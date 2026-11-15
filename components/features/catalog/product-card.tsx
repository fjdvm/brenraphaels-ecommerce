import { stockLabel } from "@/lib/catalog/stock-label";
import Image from "next/image";
import Link from "next/link";

import { ProductQuickOrder } from "@/components/features/catalog/product-quick-order";
import { Skeleton } from "@/components/ui/skeleton";
import type { CatalogProduct } from "@/lib/catalog/catalog";
import { formatPeso } from "@/lib/catalog/currency";

export function priceRange(lowest: number, highest: number) {
  return lowest === highest
    ? formatPeso(lowest)
    : `${formatPeso(lowest)} – ${formatPeso(highest)}`;
}

/** Sized like a loaded card so a grid doesn't shift when its products arrive. */
export function ProductCardSkeleton() {
  return (
    <div className="flex flex-col gap-[18px]" aria-hidden="true">
      <Skeleton className="aspect-[5/4] w-full" />
      <div className="space-y-1.5">
        <Skeleton className="h-7 w-2/3" />
        <Skeleton className="h-[18px] w-1/3" />
      </div>
      <Skeleton className="h-10 w-full rounded-full" />
    </div>
  );
}

export function ProductCard({
  product,
  customerHasCart,
}: {
  product: CatalogProduct;
  customerHasCart: boolean;
}) {
  const unavailable = product.sizes.every((size) => !size.available);
  // The tightest Size decides the notice: "Only 3 left" beats "Only 9 left".
  const tightest = product.sizes.filter((size) => size.available && stockLabel(size.left) !== null)
    .sort((a, b) => (a.left ?? 0) - (b.left ?? 0))[0];
  const notice = tightest ? stockLabel(tightest.left)?.text : undefined;
  // "In stock" only when every Size's count is known, so a failed IMS read never claims stock.
  const inStock = !unavailable && !notice && product.sizes.every((size) => size.left !== null);
  const pill = unavailable
    ? { text: "Sold out", tone: "bg-surface text-muted" }
    : notice
      ? { text: notice, tone: "bg-warning-soft text-warning" }
      : inStock
        ? { text: "In stock", tone: "bg-success-soft text-success" }
        : undefined;

  return (
    <div className="flex h-full flex-col gap-[18px]">
      <Link
        href={`/products/${product.slug}`}
        className="group flex flex-col gap-[18px] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
      >
        <div className="relative">
        <Image
          src={product.image}
          alt={product.name}
          width={800}
          height={640}
          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
          className={`aspect-[5/4] w-full object-cover transition duration-300 group-hover:scale-[1.02] ${
            unavailable ? "opacity-55" : ""
          }`}
        />
        {pill && (
          <span className={`absolute left-4 top-4 rounded-full px-3 py-1 text-xs tracking-wide ${pill.tone}`}>{pill.text}</span>
        )}
        </div>
        <div className="flex flex-col gap-1.5">
          <h2 className="font-serif text-[22px] leading-[1.3] text-ink">{product.name}</h2>
          <p className="text-xs tracking-wide text-muted">
            {unavailable ? "Currently unavailable" : product.sizes.map((size) => size.label).join(" · ")}
          </p>
        </div>
      </Link>
      <div className="mt-auto flex flex-col gap-3">
        <p className="font-medium tracking-wide text-primary">
          {priceRange(product.lowestPriceInCentavos, product.highestPriceInCentavos)}
        </p>
        {unavailable ? (
          <span className="flex h-[42px] items-center text-sm font-medium tracking-wide text-primary">Sold out</span>
        ) : (
          <ProductQuickOrder product={product} customerHasCart={customerHasCart} />
        )}
      </div>
    </div>
  );
}
