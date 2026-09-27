import Image from "next/image";
import Link from "next/link";

import { createCatalogStore } from "@/lib/catalog/catalog";
import { formatPeso } from "@/lib/catalog/currency";
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

export default async function ProductsPage() {
  const products = await createCatalogStore(getDatabase()).listProducts();

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
        <div className="grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <Link
              key={product.slug}
              href={`/products/${product.slug}`}
              className="group overflow-hidden border border-outline-variant/60 bg-surface-card transition hover:-translate-y-1 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
            >
              <Image
                src={product.image}
                alt={product.name}
                width={800}
                height={800}
                sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                className="aspect-square w-full object-cover transition duration-300 group-hover:scale-[1.02]"
              />
              <div className="p-6">
                <h2 className="font-serif text-2xl text-primary">{product.name}</h2>
                <p className="mt-2 font-semibold text-on-surface-variant">
                  {priceRange(product.lowestPriceInCentavos, product.highestPriceInCentavos)}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
