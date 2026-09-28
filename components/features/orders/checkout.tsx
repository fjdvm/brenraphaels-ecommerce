"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { placeOrder } from "@/app/(site)/(protected)/checkout/actions";
import { formatPeso } from "@/lib/catalog/currency";
import type { Cart } from "@/lib/orders/cart";
import { fulfillmentMethods, paymentMethods } from "@/lib/orders/orders";
import { Button } from "@/components/ui/button";

export function CheckoutView({ cart }: { cart: Cart }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string>();

  function submitOrder() {
    setMessage(undefined);
    startTransition(async () => {
      try {
        await placeOrder({
          fulfillmentMethod: fulfillmentMethods[0],
          paymentMethod: paymentMethods[0],
        });
        router.push("/profile/orders");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "We couldn't place your Order. Please try again.");
      }
    });
  }

  return (
    <section className="mx-auto max-w-4xl px-5 py-12 sm:px-8 lg:py-20">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-secondary">Checkout</p>
      <h1 className="mt-3 font-serif text-5xl text-primary">Review your Order</h1>
      {cart.lines.length === 0 ? (
        <div className="mt-10 border-y border-outline-variant/60 py-10">
          <p className="text-lg text-on-surface-variant">Your Cart is empty.</p>
          <Link className="mt-4 inline-block font-semibold text-primary underline underline-offset-4" href="/products">Shop our products</Link>
        </div>
      ) : (
        <>
          <div className="mt-10 grid gap-8 md:grid-cols-2">
            <section aria-labelledby="items-heading">
              <h2 id="items-heading" className="font-serif text-2xl text-primary">Your Cart</h2>
              <ul className="mt-4 divide-y divide-outline-variant/60 border-y border-outline-variant/60">
                {cart.lines.map((line) => (
                  <li key={line.id} className="py-4">
                    <p className="font-semibold text-primary">{line.productName}</p>
                    <p className="mt-1 text-sm text-on-surface-variant">{line.sizeLabel} · {line.quantity} × {formatPeso(line.priceInCentavos)}</p>
                    {!line.available && <p className="mt-1 text-sm font-semibold text-secondary">This Size is currently unavailable.</p>}
                  </li>
                ))}
              </ul>
              <p className="mt-4 flex justify-between font-bold text-primary"><span>Subtotal</span><span>{formatPeso(cart.subtotalInCentavos)}</span></p>
            </section>
            <section aria-labelledby="choices-heading">
              <h2 id="choices-heading" className="font-serif text-2xl text-primary">Your choices</h2>
              <dl className="mt-4 space-y-4 rounded-md border border-outline-variant/60 p-5">
                <div>
                  <dt className="text-sm font-semibold text-on-surface-variant">Fulfillment method</dt>
                  <dd className="mt-1 font-semibold text-primary">Pickup</dd>
                  <p className="mt-1 text-sm text-on-surface-variant">There is no Delivery fee for Pickup.</p>
                </div>
                <div>
                  <dt className="text-sm font-semibold text-on-surface-variant">Payment method</dt>
                  <dd className="mt-1 font-semibold text-primary">Cash on Delivery</dd>
                  <p className="mt-1 text-sm text-on-surface-variant">Pay cash when you collect your Order.</p>
                </div>
              </dl>
            </section>
          </div>
          {message && <p role="alert" className="mt-6 font-semibold text-secondary">{message}</p>}
          <div className="mt-8 flex flex-wrap gap-4">
            <Button disabled={isPending || cart.lines.some((line) => !line.available)} onClick={submitOrder} size="lg" type="button">
              {isPending ? "Placing Order…" : "Place Order"}
            </Button>
            <Button asChild size="lg" variant="outline"><Link href="/cart">Edit Cart</Link></Button>
          </div>
        </>
      )}
    </section>
  );
}
