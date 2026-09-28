import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";

import { ProductQuickOrder } from "@/components/features/catalog/product-quick-order";
import { createCatalogStore } from "@/lib/catalog/catalog";
import { formatPeso } from "@/lib/catalog/currency";
import { currentVisitor } from "@/lib/customer/current-visitor";
import { getDatabase } from "@/lib/db";

export const dynamic = "force-dynamic";

function priceRange(lowest: number, highest: number) {
  return lowest === highest
    ? formatPeso(lowest)
    : `${formatPeso(lowest)} – ${formatPeso(highest)}`;
}

export const metadata = {
  title: "Shop",
  description: "Browse Bren Raphael's Ube Jam, Ube Halaya, and Ube Powder.",
};

/** Skeleton shown immediately while the product list and session resolve. */
function ProductsGridFallback() {
  return (
    <div className="grid gap-7 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className="animate-pulse overflow-hidden border border-outline-variant/60 bg-surface-card"
        >
          <div className="aspect-square w-full bg-surface-container-low" />
          <div className="space-y-3 p-6 pb-4">
            <div className="h-6 w-2/3 bg-surface-container-low" />
            <div className="h-4 w-1/3 bg-surface-container-low" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Resolves the product list and cart-visibility rule only inside its own boundary. */
async function ProductsGrid() {
  const [products, visitor] = await Promise.all([
    createCatalogStore(getDatabase()).listProducts(),
    currentVisitor(),
  ]);
  const customerHasCart = visitor.state === "customer";

  return (
    <div className="grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
      {products.map((product) => {
        const unavailable = product.sizes.every((size) => !size.available);
        return (
          <div
            key={product.slug}
            className="group overflow-hidden border border-outline-variant/60 bg-surface-card transition hover:-translate-y-1 hover:shadow-lg"
          >
            <Link
              href={`/products/${product.slug}`}
              className="block focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-primary"
            >
              <div className="relative">
                <Image
                  src={product.image}
                  alt={product.name}
                  width={800}
                  height={800}
                  sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                  className="aspect-square w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                />
                {unavailable && (
                  <span className="absolute left-3 top-3 bg-on-surface/90 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-surface">
                    Unavailable
                  </span>
                )}
              </div>
              <div className="p-6 pb-4">
                <h2 className="font-serif text-2xl text-primary">{product.name}</h2>
                <p className="mt-2 font-semibold text-on-surface-variant">
                  {priceRange(product.lowestPriceInCentavos, product.highestPriceInCentavos)}
                </p>
              </div>
            </Link>
            <div className="px-6 pb-6">
              <ProductQuickOrder product={product} customerHasCart={customerHasCart} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function ProductsPage() {
  return (
    <div className="bg-surface">
      <section className="border-b border-outline-variant/50 bg-surface-container-low px-5 py-16 sm:px-8">
        <div className="mx-auto max-w-7xl">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-secondary">Shop</p>
          <h1 className="mt-3 font-serif text-5xl text-primary">Our products</h1>
          <p className="mt-4 max-w-xl text-lg leading-8 text-on-surface-variant">
            Made with real ube, ready for your kitchen and your celebrations.
          </p>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-5 py-14 sm:px-8">
        <Suspense fallback={<ProductsGridFallback />}>
          <ProductsGrid />
        </Suspense>
      </section>
    </div>
  );
}
