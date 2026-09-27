"use client";

import { startTransition, useEffect, useRef } from "react";

import { mergeVisitorCart } from "@/app/(site)/cart/actions";
import { clearVisitorCart, readVisitorCart, visitorCartId } from "@/lib/orders/visitor-cart";

/** Moves the browser Cart into the Customer's Cart as soon as a Customer signs in. */
export function CartSessionSync({ customerId }: { customerId?: string }) {
  const mergedCustomerId = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!customerId || mergedCustomerId.current === customerId) return;
    mergedCustomerId.current = customerId;
    const visitorLines = readVisitorCart();
    if (visitorLines.length === 0) return;

    startTransition(async () => {
      try {
        await mergeVisitorCart(
          visitorCartId(),
          visitorLines.map(({ sizeId, quantity }) => ({ sizeId, quantity })),
        );
        clearVisitorCart();
        window.dispatchEvent(new Event("cart-merged"));
      } catch {
        // Keep the Visitor Cart intact so a temporary network problem never loses it.
        mergedCustomerId.current = undefined;
      }
    });
  }, [customerId]);

  return null;
}
