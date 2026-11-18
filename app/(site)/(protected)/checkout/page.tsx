import { Suspense } from "react";

import { CheckoutView } from "@/components/features/orders/checkout";
import { CheckoutSkeleton } from "@/components/features/orders/checkout-skeleton";
import { requireCustomer } from "@/lib/customer/current-visitor";
import { getDatabase } from "@/lib/db";
import { loadFreeDeliveryThreshold } from "@/lib/orders/free-delivery-threshold";
import { paymentDetails } from "@/lib/orders/payment-details";
import { createCartStore } from "@/lib/orders/cart";
import { activeVerification } from "@/lib/senior-pwd/store";

export const dynamic = "force-dynamic";

async function CheckoutPageContent() {
  const customer = await requireCustomer();
  const cart = await createCartStore(getDatabase()).get(customer.userId);
  const verification = await activeVerification(getDatabase(), customer.userId);
  return <CheckoutView seniorPwdStanding={{ verified: verification !== null, expiresOn: verification?.expiresOn ?? null }} cart={cart} addresses={customer.addresses} paymentDetails={await paymentDetails()} freeDeliveryThresholdInCentavos={await loadFreeDeliveryThreshold()} />;
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<CheckoutSkeleton />}>
      <CheckoutPageContent />
    </Suspense>
  );
}
