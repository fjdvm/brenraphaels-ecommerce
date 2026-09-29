import { Suspense } from "react";

import { CheckoutView } from "@/components/features/orders/checkout";
import { Skeleton } from "@/components/ui/skeleton";
import { requireCustomer } from "@/lib/customer/current-visitor";
import { getDatabase } from "@/lib/db";
import { createCartStore } from "@/lib/orders/cart";
import { listProvinces } from "@/lib/address/locations";

export const dynamic = "force-dynamic";

/** Skeleton shown immediately while the cart, addresses, and customer resolve. */
function CheckoutPageSkeleton() {
  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-5 py-10 sm:px-8 sm:py-14 lg:grid-cols-2" aria-hidden="true">
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    </div>
  );
}

async function CheckoutPageContent() {
  const customer = await requireCustomer();
  const cart = await createCartStore(getDatabase()).get(customer.userId);
  return <CheckoutView cart={cart} addresses={customer.addresses} provinces={listProvinces()} />;
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<CheckoutPageSkeleton />}>
      <CheckoutPageContent />
    </Suspense>
  );
}
