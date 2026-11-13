import { CreditCard, Store, Truck } from "lucide-react";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ProductCard, priceRange } from "@/components/features/catalog/product-card";
import { ProductDetails } from "@/components/features/catalog/product-details";
import { ProductGallery } from "@/components/features/catalog/product-gallery";
import {
  ProductPageFrame,
  ProductPageSkeleton,
  RelatedProductsSkeleton,
} from "@/components/features/catalog/product-page-frame";
import { AddToCart } from "@/components/features/orders/add-to-cart";
import { createCatalogStore } from "@/lib/catalog/catalog";
import { parseProductDescription } from "@/lib/catalog/description";
import { currentVisitor } from "@/lib/customer/current-visitor";
import { getDatabase } from "@/lib/db";

export const dynamic = "force-dynamic";

type ProductPageProps = { params: Promise<{ slug: string }> };

const fulfilment = [
  { icon: Store, title: "Store pickup", text: "Block 14 Lot 1A, Marigman St., San Roque, Antipolo" },
  { icon: Truck, title: "Delivery", text: "Delivery fee is confirmed by our team after you place your order" },
  { icon: CreditCard, title: "Payment", text: "GCash or Cash on Delivery" },
];

/** Other Products to browse next, loaded in its own boundary so the Product itself shows first. */
async function RelatedProducts({ slug }: { slug: string }) {
  const [products, visitor] = await Promise.all([
    createCatalogStore(getDatabase()).listProducts(),
    currentVisitor(),
  ]);
  const related = products.filter((product) => product.slug !== slug).slice(0, 4);
  if (related.length === 0) return null;

  return (
    <div className="grid gap-[30px] sm:grid-cols-2 lg:grid-cols-4">
      {related.map((product) => (
        <ProductCard key={product.slug} product={product} customerHasCart={visitor.state === "customer"} />
      ))}
    </div>
  );
}

async function ProductPageContent({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await createCatalogStore(getDatabase()).findProduct(slug);
  if (!product) notFound();
  const visitor = await currentVisitor();
  const description = parseProductDescription(product.description);
  const prices = product.sizes.map((size) => size.priceInCentavos);

  return (
    <>
      <ProductPageFrame crumb={product.name}>
        <div className="grid gap-10 lg:grid-cols-[1fr_600px] lg:gap-[60px]">
          <ProductGallery images={product.images} />
          <div className="flex flex-col gap-[30px]">
            <div className="flex flex-col gap-3.5">
              <h1 className="font-serif text-4xl leading-[1.2] text-primary sm:text-[54px]">{product.name}</h1>
              <p className="font-serif text-[32px] leading-[1.2] text-ink sm:text-[40px]">
                {priceRange(Math.min(...prices), Math.max(...prices))}
              </p>
              {description.summary.map((paragraph) => (
                <p key={paragraph} className="leading-relaxed tracking-wide text-body">{paragraph}</p>
              ))}
            </div>
            <div className="h-px bg-line" />
            <AddToCart
              product={{ slug: product.slug, name: product.name, image: product.images[0]?.url, sizes: product.sizes }}
              customerHasCart={visitor.state === "customer"}
            />
            <div className="flex flex-col gap-[18px] bg-surface-container-low p-[30px]">
              {fulfilment.map(({ icon: Icon, title, text }) => (
                <div key={title} className="flex items-start gap-3.5">
                  <Icon aria-hidden className="mt-0.5 size-[22px] shrink-0 text-primary" />
                  <div className="flex flex-col gap-0.5 text-sm leading-normal tracking-wide">
                    <p className="font-medium text-ink">{title}</p>
                    <p className="text-body">{text}</p>
                  </div>
                </div>
              ))}
            </div>
            <ProductDetails sections={description.sections} />
          </div>
        </div>
      </ProductPageFrame>
      <section className="mx-auto flex max-w-[1440px] flex-col gap-10 px-5 pb-[100px] sm:px-10">
        <div className="flex flex-col gap-4 text-primary">
          <p className="text-xs font-medium uppercase tracking-[0.15em]">Pairs well with</p>
          <h2 className="font-serif text-[32px] leading-[1.2] sm:text-[40px]">You may also like</h2>
        </div>
        <Suspense fallback={<RelatedProductsSkeleton />}>
          <RelatedProducts slug={slug} />
        </Suspense>
      </section>
    </>
  );
}

export default function ProductPage(props: ProductPageProps) {
  return (
    <Suspense fallback={<ProductPageSkeleton />}>
      <ProductPageContent {...props} />
    </Suspense>
  );
}
