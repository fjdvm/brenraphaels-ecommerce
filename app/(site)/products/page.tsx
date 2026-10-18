import { Suspense } from "react";

import { ProductCard } from "@/components/features/catalog/product-card";
import {
  ProductsFrame,
  ProductsGridFallback,
  productsGridClass,
} from "@/components/features/catalog/products-frame";
import { createCatalogStore } from "@/lib/catalog/catalog";
import { currentVisitor } from "@/lib/customer/current-visitor";
import { getDatabase } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Shop",
  description: "Browse Bren Raphael's Ube Jam, Ube Halaya, and Ube Powder.",
};

/** Resolves the product list and cart-visibility rule only inside its own boundary. */
async function ProductsGrid() {
  const [products, visitor] = await Promise.all([
    createCatalogStore(getDatabase()).listProducts(),
    currentVisitor(),
  ]);
  const customerHasCart = visitor.state === "customer";

  return (
    <div className={productsGridClass}>
      {products.map((product) => (
        <ProductCard key={product.slug} product={product} customerHasCart={customerHasCart} />
      ))}
    </div>
  );
}

export default function ProductsPage() {
  return (
    <ProductsFrame>
      <Suspense fallback={<ProductsGridFallback />}>
        <ProductsGrid />
      </Suspense>
    </ProductsFrame>
  );
}
