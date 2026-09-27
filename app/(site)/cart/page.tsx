import { CartView } from "@/components/features/orders/cart";
import { currentVisitor } from "@/lib/customer/current-visitor";
import { getDatabase } from "@/lib/db";
import { createCartStore, type Cart } from "@/lib/orders/cart";

export const dynamic = "force-dynamic";

const emptyCart: Cart = { lines: [], subtotalInCentavos: 0 };

export default async function CartPage() {
  const visitor = await currentVisitor();
  const customerHasCart = visitor.state === "customer";
  const initialCart = customerHasCart
    ? await createCartStore(getDatabase()).get(visitor.customer.userId)
    : emptyCart;

  return <CartView customerHasCart={customerHasCart} initialCart={initialCart} />;
}
