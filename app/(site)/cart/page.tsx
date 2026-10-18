import { Suspense } from "react";

import { CartView } from "@/components/features/orders/cart";
import { CartSkeleton } from "@/components/features/orders/cart-skeleton";
import { currentVisitor } from "@/lib/customer/current-visitor";
import { getDatabase } from "@/lib/db";
import { createCartStore, type Cart } from "@/lib/orders/cart";

export const dynamic = "force-dynamic";

const emptyCart: Cart = { lines: [], subtotalInCentavos: 0 };

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
    <Suspense fallback={<CartSkeleton />}>
      <CartPageContent />
    </Suspense>
  );
}
