import type { ReactNode } from "react";

import { ProductCardSkeleton } from "@/components/features/catalog/product-card";
import { Breadcrumb } from "@/components/shared/breadcrumb";
import { Skeleton } from "@/components/ui/skeleton";

/** The static shell of a Product page: the breadcrumb and the page width. */
export function ProductPageFrame({ crumb, children }: { crumb?: string; children: ReactNode }) {
  return (
    <div className="bg-surface">
      <section className="mx-auto flex max-w-[1440px] flex-col gap-[30px] px-5 pb-[100px] pt-10 sm:px-10">
        {crumb ? (
          <Breadcrumb crumbs={[{ label: "Home", href: "/" }, { label: "Shop", href: "/products" }, { label: crumb }]} />
        ) : (
          <Skeleton className="h-[18px] w-64" />
        )}
        {children}
      </section>
    </div>
  );
}

export function RelatedProductsSkeleton() {
  return (
    <div className="grid gap-[30px] sm:grid-cols-2 lg:grid-cols-4" aria-hidden="true">
      {Array.from({ length: 4 }).map((_, index) => (
        <ProductCardSkeleton key={index} />
      ))}
    </div>
  );
}

/** Sized like the loaded Product so nothing shifts when it resolves. */
export function ProductPageSkeleton() {
  return (
    <ProductPageFrame>
      <div className="grid gap-10 lg:grid-cols-[1fr_600px] lg:gap-[60px]" aria-hidden="true">
        <div className="flex flex-col gap-5">
          <Skeleton className="aspect-square w-full rounded-[40px] lg:aspect-auto lg:h-[700px]" />
          <div className="grid grid-cols-4 gap-5">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="aspect-square rounded-[40px]" />
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-[30px]">
          <Skeleton className="h-14 w-3/4" />
          <Skeleton className="h-10 w-1/3" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-14 w-full rounded-full" />
          <Skeleton className="h-14 w-full rounded-full" />
        </div>
      </div>
    </ProductPageFrame>
  );
}
