import Link from "next/link";
import { Suspense } from "react";

import { ProductCard } from "@/components/features/catalog/product-card";
import {
  ProductsFrame,
  ProductsGridFallback,
  ShopToolbarFallback,
  productsGridClass,
} from "@/components/features/catalog/products-frame";
import { shopHref } from "@/components/features/catalog/shop-href";
import { ShopSearch } from "@/components/features/catalog/shop-search";
import { ShopSort } from "@/components/features/catalog/shop-sort";
import { browseProducts, categories, parseBrowseParams } from "@/lib/catalog/browse";
import { createCatalogStore } from "@/lib/catalog/catalog";
import { currentVisitor } from "@/lib/customer/current-visitor";
import { getDatabase } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Shop",
  description: "Browse Bren Raphael's Ube Jam, Ube Halaya, and Ube Powder.",
};

const chipClass = "rounded-full border px-[22px] py-[11px] text-sm font-medium tracking-wide transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

/** Reads the filter, sort and product list only inside its own boundary. */
async function ShopBrowser({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = parseBrowseParams(await searchParams);
  const [allProducts, visitor] = await Promise.all([
    createCatalogStore(getDatabase()).listProducts(),
    currentVisitor(),
  ]);
  const customerHasCart = visitor.state === "customer";
  const products = browseProducts(allProducts, params);
  const chips = [{ value: undefined, label: "All" }, ...categories];

  return (
    <div className="flex flex-col gap-10">
      <ShopSearch params={params} />
      <div className="flex flex-wrap items-center gap-3">
        {chips.map(({ value, label }) => {
          const active = params.category === value;
          return (
            <Link
              key={label}
              href={shopHref("/products", { ...params, category: value })}
              aria-current={active ? "true" : undefined}
              scroll={false}
              className={`${chipClass} ${active ? "border-primary bg-primary text-white" : "border-line bg-white text-ink hover:border-primary"}`}
            >
              {label}
            </Link>
          );
        })}
        <p className="ml-auto text-sm tracking-wide text-muted" role="status">
          {products.length} {products.length === 1 ? "product" : "products"}
        </p>
        <ShopSort params={params} />
      </div>
      {products.length === 0 ? (
        <p className="py-10 text-center text-body">{params.q ? `No products match “${params.q}”.` : "No products in this category yet."}</p>
      ) : (
        <div className={productsGridClass}>
          {products.map((product) => (
            <ProductCard key={product.slug} product={product} customerHasCart={customerHasCart} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function ProductsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return (
    <ProductsFrame>
      <Suspense
        fallback={
          <div className="flex flex-col gap-10">
            <ShopToolbarFallback />
            <ProductsGridFallback />
          </div>
        }
      >
        <ShopBrowser searchParams={searchParams} />
      </Suspense>
    </ProductsFrame>
  );
}
