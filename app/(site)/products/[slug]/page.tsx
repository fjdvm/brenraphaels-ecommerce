import { notFound } from "next/navigation";

import { ProductGallery } from "@/components/features/catalog/product-gallery";
import { AddToCart } from "@/components/features/orders/add-to-cart";
import { createCatalogStore } from "@/lib/catalog/catalog";
import { formatPeso } from "@/lib/catalog/currency";
import { currentVisitor } from "@/lib/customer/current-visitor";
import { getDatabase } from "@/lib/db";

export const dynamic = "force-dynamic";

type ProductPageProps = { params: Promise<{ slug: string }> };

export default async function ProductPage({ params }: ProductPageProps) {
  const product = await createCatalogStore(getDatabase()).findProduct((await params).slug);
  if (!product) notFound();
  const visitor = await currentVisitor();

  return (
    <div className="bg-surface">
      <section className="mx-auto grid max-w-7xl gap-10 px-5 py-12 sm:px-8 lg:grid-cols-2 lg:py-20">
        <ProductGallery images={product.images} />
        <div className="lg:pt-4">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-secondary">Bren Raphael&apos;s</p>
          <h1 className="mt-3 font-serif text-5xl leading-tight text-primary">{product.name}</h1>
          <p className="mt-6 whitespace-pre-line leading-7 text-on-surface-variant">
            {product.description}
          </p>
          <section className="mt-10 border-t border-outline-variant/60 pt-6" aria-labelledby="sizes-heading">
            <h2 id="sizes-heading" className="font-serif text-2xl text-primary">Sizes</h2>
            <ul className="mt-4 divide-y divide-outline-variant/60 border-y border-outline-variant/60">
              {product.sizes.map((size) => (
                <li key={size.label} className="flex items-center justify-between gap-4 py-4">
                  <span className="font-semibold text-on-surface">{size.label}</span>
                  <span className={size.available ? "font-semibold text-primary" : "text-on-surface-variant"}>
                    {formatPeso(size.priceInCentavos)}
                    {!size.available ? " · Unavailable" : ""}
                  </span>
                </li>
              ))}
            </ul>
          </section>
          <AddToCart
            product={{ slug: product.slug, name: product.name, sizes: product.sizes }}
            customerHasCart={visitor.state === "customer"}
          />
        </div>
      </section>
    </div>
  );
}
