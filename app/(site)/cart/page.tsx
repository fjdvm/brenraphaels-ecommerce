import { Suspense } from "react";

import { CartView } from "@/components/features/orders/cart";
import { Skeleton } from "@/components/ui/skeleton";
import { currentVisitor } from "@/lib/customer/current-visitor";
import { getDatabase } from "@/lib/db";
import { createCartStore, type Cart } from "@/lib/orders/cart";

export const dynamic = "force-dynamic";

const emptyCart: Cart = { lines: [], subtotalInCentavos: 0 };

/** Skeleton shown immediately while the cart and session resolve. */
function CartPageSkeleton() {
  return (
    <div className="mx-auto max-w-4xl space-y-4 px-5 py-10 sm:px-8 sm:py-14" aria-hidden="true">
      <Skeleton className="h-10 w-48" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-12 w-40" />
    </div>
  );
}

async function CartPageContent() {
  const visitor = await currentVisitor();
  const customerHasCart = visitor.state === "customer";
  const initialCart = customerHasCart
    ? await createCartStore(getDatabase()).get(visitor.customer.userId)
    : emptyCart;

  return <CartView customerHasCart={customerHasCart} initialCart={initialCart} />;
}

export default function CartPage() {
  return (
    <Suspense fallback={<CartPageSkeleton />}>
      <CartPageContent />
    </Suspense>
  );
}
