import Image from "next/image";
import Link from "next/link";

import { Skeleton } from "@/components/ui/skeleton";
import { createCatalogStore } from "@/lib/catalog/catalog";
import { formatPeso } from "@/lib/catalog/currency";
import { getDatabase } from "@/lib/db";

const shown = 4;

function priceRange(lowest: number, highest: number) {
  return lowest === highest
    ? formatPeso(lowest)
    : `${formatPeso(lowest)} – ${formatPeso(highest)}`;
}

const gridClass = "grid gap-[30px] sm:grid-cols-2 lg:grid-cols-4";

/** Sized like the loaded cards so the row doesn't shift when the products arrive. */
export function BestsellersFallback() {
  return (
    <div className={gridClass} aria-hidden="true">
      {Array.from({ length: shown }).map((_, index) => (
        <div key={index} className="flex flex-col gap-[18px]">
          <Skeleton className="aspect-square w-full rounded-[40px]" />
          <Skeleton className="h-7 w-2/3" />
          <Skeleton className="h-5 w-1/3" />
        </div>
      ))}
    </div>
  );
}

/** Shows the first products of the catalog; a failed lookup leaves the section out. */
export async function Bestsellers() {
  let products;
  try {
    products = (await createCatalogStore(getDatabase()).listProducts()).slice(0, shown);
  } catch {
    return null;
  }

  return (
    <div className={gridClass}>
      {products.map((product) => (
        <Link
          key={product.slug}
          href={`/products/${product.slug}`}
          className="group flex flex-col gap-[18px] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
        >
          <Image
            src={product.image}
            alt={product.name}
            width={640}
            height={640}
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
            className="aspect-square w-full rounded-[40px] object-cover transition duration-300 group-hover:scale-[1.02]"
          />
          <div className="space-y-1.5">
            <h3 className="font-serif text-[22px] leading-[1.3] text-on-surface">
              {product.name}
            </h3>
            <p className="font-medium text-primary">
              {priceRange(product.lowestPriceInCentavos, product.highestPriceInCentavos)}
            </p>
          </div>
        </Link>
      ))}
    </div>
  );
}
