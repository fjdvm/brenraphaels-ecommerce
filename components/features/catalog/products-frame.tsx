import { Heart, Star, Truck } from "lucide-react";
import type { ReactNode } from "react";

import { ProductCardSkeleton } from "@/components/features/catalog/product-card";
import { Breadcrumb } from "@/components/shared/breadcrumb";
import { PageHeading } from "@/components/ui/page-heading";
import { Skeleton } from "@/components/ui/skeleton";

const reasons = [
  { icon: Heart, title: "100% real ube", text: "Made from steamed, fresh purple yam — never artificial flavoring." },
  { icon: Star, title: "Small-batch & handmade", text: "Slow-cooked the old-fashioned way, with patience, love and care." },
  { icon: Truck, title: "Delivery", text: "We deliver your order to your door." },
];

/** Sized like the loaded chips row so the toolbar doesn't shift. */
export function ShopToolbarFallback() {
  return <Skeleton className="h-[44px] w-full rounded-full" aria-hidden="true" />;
}

export const productsGridClass = "grid gap-x-[30px] gap-y-[60px] sm:grid-cols-2 lg:grid-cols-3";

/** Sized like the loaded grid so nothing shifts when the products arrive. */
export function ProductsGridFallback() {
  return (
    <div className={productsGridClass} aria-hidden="true">
      {Array.from({ length: 6 }).map((_, index) => (
        <ProductCardSkeleton key={index} />
      ))}
    </div>
  );
}

/** The static shell of the Shop page, shared by the page and its loading state. */
export function ProductsFrame({ children }: { children: ReactNode }) {
  return (
    <div className="bg-surface">
      <section className="mx-auto max-w-[1440px] px-5 pb-[50px] pt-16 sm:px-10 lg:pt-[100px]">
        <div className="flex flex-col gap-[30px]">
          <Breadcrumb crumbs={[{ label: "Home", href: "/" }, { label: "Shop" }]} />
          <PageHeading eyebrow="Shop" title="Our products">
            <p className="max-w-[520px] leading-relaxed tracking-wide text-body">
              Made with real ube, ready for your kitchen and your celebrations.
            </p>
          </PageHeading>
        </div>
      </section>
      <section className="mx-auto max-w-[1440px] px-5 pb-[100px] sm:px-10">{children}</section>
      <section className="mx-auto max-w-[1440px] px-5 pb-[100px] sm:px-10">
        <div className="grid gap-5 md:grid-cols-3">
          {reasons.map(({ icon: Icon, title, text }) => (
            <div key={title} className="flex flex-col gap-4 bg-lavender-soft p-8 sm:p-10">
              <span className="grid size-[52px] place-items-center rounded-full bg-white text-primary">
                <Icon aria-hidden className="size-[23px]" />
              </span>
              <h2 className="font-serif text-[28px] leading-tight text-primary">{title}</h2>
              <p className="text-sm leading-normal tracking-wide text-body">{text}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
