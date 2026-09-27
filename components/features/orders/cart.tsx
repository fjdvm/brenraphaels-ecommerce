"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";

import { getPersistedCart, removeCartLine, updateCartLine } from "@/app/(site)/cart/actions";
import { formatPeso } from "@/lib/catalog/currency";
import {
  guestCartLineQuantityLimit,
  readGuestCart,
  writeGuestCart,
} from "@/lib/orders/guest-cart";
import type { Cart, CartLine } from "@/lib/orders/cart";

type DisplayLine = Pick<CartLine, "id" | "sizeId" | "productSlug" | "productName" | "sizeLabel" | "priceInCentavos" | "quantity" | "available">;

function guestCart(): Cart {
  const lines = readGuestCart().map((line) => ({ ...line, id: line.sizeId, available: true }));
  return {
    lines,
    subtotalInCentavos: lines.reduce((subtotal, line) => subtotal + line.priceInCentavos * line.quantity, 0),
  };
}

export function CartView({ customerHasCart, initialCart }: { customerHasCart: boolean; initialCart: Cart }) {
  const [cart, setCart] = useState<Cart>(initialCart);
  const [message, setMessage] = useState<string>();
  const [pendingLineId, setPendingLineId] = useState<number>();
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!customerHasCart) {
      const timer = window.setTimeout(() => setCart(guestCart()), 0);
      return () => window.clearTimeout(timer);
    }

    const loadCart = () => {
      void getPersistedCart().then(setCart).catch(() => undefined);
    };
    loadCart();
    window.addEventListener("cart-merged", loadCart);
    return () => window.removeEventListener("cart-merged", loadCart);
  }, [customerHasCart]);

  function changeQuantity(line: DisplayLine, quantity: number) {
    if (quantity < 1) return remove(line);
    setPendingLineId(line.id);
    setMessage(undefined);
    if (customerHasCart) {
      startTransition(async () => {
        try {
          setCart(await updateCartLine(line.id, quantity));
        } catch {
          setMessage("We couldn't update that Cart line. Please try again.");
        } finally {
          setPendingLineId(undefined);
        }
      });
      return;
    }

    const next = readGuestCart().map((guestLine) => (
      guestLine.sizeId === line.sizeId
        ? { ...guestLine, quantity: Math.min(quantity, guestCartLineQuantityLimit) }
        : guestLine
    ));
    writeGuestCart(next);
    setCart(guestCart());
    setPendingLineId(undefined);
  }

  function remove(line: DisplayLine) {
    setPendingLineId(line.id);
    setMessage(undefined);
    if (customerHasCart) {
      startTransition(async () => {
        try {
          setCart(await removeCartLine(line.id));
        } catch {
          setMessage("We couldn't remove that Cart line. Please try again.");
        } finally {
          setPendingLineId(undefined);
        }
      });
      return;
    }

    writeGuestCart(readGuestCart().filter((guestLine) => guestLine.sizeId !== line.sizeId));
    setCart(guestCart());
    setPendingLineId(undefined);
  }

  return (
    <section className="mx-auto max-w-4xl px-5 py-12 sm:px-8 lg:py-20">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-secondary">Your Cart</p>
      <h1 className="mt-3 font-serif text-5xl text-primary">Cart</h1>
      {cart.lines.length === 0 ? (
        <div className="mt-10 border-y border-outline-variant/60 py-10">
          <p className="text-lg text-on-surface-variant">Your Cart is empty.</p>
          <Link href="/products" className="mt-4 inline-block font-semibold text-primary underline underline-offset-4">Shop our products</Link>
        </div>
      ) : (
        <>
          <ul className="mt-10 divide-y divide-outline-variant/60 border-y border-outline-variant/60">
            {cart.lines.map((line) => {
              const pending = isPending && pendingLineId === line.id;
              return (
                <li key={line.id} className="flex flex-wrap items-center justify-between gap-5 py-5">
                  <div>
                    <Link href={`/products/${line.productSlug}`} className="font-serif text-xl text-primary hover:underline">{line.productName}</Link>
                    <p className="mt-1 text-sm text-on-surface-variant">{line.sizeLabel} · {formatPeso(line.priceInCentavos)} each</p>
                    {!line.available && <p className="mt-1 text-sm font-semibold text-secondary">This Size is currently unavailable.</p>}
                  </div>
                  <div className="flex items-center gap-3">
                    <button type="button" aria-label={`Decrease ${line.productName} quantity`} disabled={pending} onClick={() => changeQuantity(line, line.quantity - 1)} className="border border-outline-variant px-3 py-1 disabled:opacity-50">−</button>
                    <span aria-label={`${line.productName} quantity`} className="min-w-5 text-center font-semibold">{line.quantity}</span>
                    <button type="button" aria-label={`Increase ${line.productName} quantity`} disabled={pending || line.quantity === guestCartLineQuantityLimit} onClick={() => changeQuantity(line, line.quantity + 1)} className="border border-outline-variant px-3 py-1 disabled:opacity-50">+</button>
                    <button type="button" disabled={pending} onClick={() => remove(line)} className="text-sm font-semibold text-secondary underline underline-offset-4 disabled:opacity-50">Remove</button>
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="mt-6 flex justify-between border-t border-outline-variant/60 pt-6 text-xl font-bold text-primary">
            <span>Subtotal</span>
            <span>{formatPeso(cart.subtotalInCentavos)}</span>
          </div>
        </>
      )}
      {message && <p role="status" className="mt-4 font-semibold text-secondary">{message}</p>}
    </section>
  );
}
