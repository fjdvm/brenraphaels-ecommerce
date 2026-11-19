import { Suspense } from "react";

import { CheckoutView } from "@/components/features/orders/checkout";
import { CheckoutSkeleton } from "@/components/features/orders/checkout-skeleton";
import { requireCustomer } from "@/lib/customer/current-visitor";
import { getDatabase } from "@/lib/db";
import { loadFreeDeliveryThreshold } from "@/lib/orders/free-delivery-threshold";
import { fetchPaymentAvailability } from "@/lib/orders/payment-availability";
import { createCartStore } from "@/lib/orders/cart";
import { discountedLine, describeDiscount, loadDiscountRule, ruleDiscount } from "@/lib/senior-pwd/discount-rule";
import { activeVerification } from "@/lib/senior-pwd/store";

export const dynamic = "force-dynamic";

async function CheckoutPageContent() {
  const customer = await requireCustomer();
  const [cart, availability] = await Promise.all([createCartStore(getDatabase()).get(customer.userId), fetchPaymentAvailability()]);
  const verification = await activeVerification(getDatabase(), customer.userId);
  // A verified Customer gets the CREOMS discount automatically, so show what it takes off this Cart.
  const rule = verification ? await loadDiscountRule() : null;
  const line = rule ? discountedLine(cart.lines) : undefined;
  const seniorPwdDiscount = rule && line ? { label: describeDiscount(rule), discountInCentavos: ruleDiscount(rule, line.priceInCentavos) } : null;
  return <CheckoutView availability={availability} seniorPwdDiscount={seniorPwdDiscount} cart={cart} addresses={customer.addresses} freeDeliveryThresholdInCentavos={await loadFreeDeliveryThreshold()} />;
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<CheckoutSkeleton />}>
      <CheckoutPageContent />
    </Suspense>
  );
}
