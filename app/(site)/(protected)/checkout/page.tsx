import { Suspense } from "react";

import { CheckoutView } from "@/components/features/orders/checkout";
import { CheckoutSkeleton } from "@/components/features/orders/checkout-skeleton";
import { requireCustomer } from "@/lib/customer/current-visitor";
import { getDatabase } from "@/lib/db";
import { paymentDetails } from "@/lib/orders/payment-details";
import { createCartStore } from "@/lib/orders/cart";
import { listProvinces } from "@/lib/address/locations";

export const dynamic = "force-dynamic";

async function CheckoutPageContent() {
  const customer = await requireCustomer();
  const cart = await createCartStore(getDatabase()).get(customer.userId);
  return <CheckoutView cart={cart} addresses={customer.addresses} provinces={listProvinces()} paymentDetails={paymentDetails()} />;
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<CheckoutSkeleton />}>
      <CheckoutPageContent />
    </Suspense>
  );
}
