"use client";

import { startTransition, useEffect, useRef } from "react";

import { mergeGuestCart } from "@/app/(site)/cart/actions";
import { readGuestCart, writeGuestCart } from "@/lib/orders/guest-cart";

/** Moves the browser Cart into the Customer's Cart as soon as a Customer signs in. */
export function CartSessionSync({ customerId }: { customerId?: string }) {
  const mergedCustomerId = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!customerId || mergedCustomerId.current === customerId) return;
    mergedCustomerId.current = customerId;
    const guestLines = readGuestCart();
    if (guestLines.length === 0) return;

    startTransition(async () => {
      try {
        await mergeGuestCart(guestLines.map(({ sizeId, quantity }) => ({ sizeId, quantity })));
        writeGuestCart([]);
        window.dispatchEvent(new Event("cart-merged"));
      } catch {
        // Keep the guest Cart intact so a temporary network problem never loses it.
        mergedCustomerId.current = undefined;
      }
    });
  }, [customerId]);

  return null;
}
