import { CheckoutView } from "@/components/features/orders/checkout";
import { requireCustomer } from "@/lib/customer/current-visitor";
import { getDatabase } from "@/lib/db";
import { createCartStore } from "@/lib/orders/cart";

export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const customer = await requireCustomer();
  const cart = await createCartStore(getDatabase()).get(customer.userId);
  return <CheckoutView cart={cart} />;
}
