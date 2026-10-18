"use client";

import { ArrowRight, Minus, Plus, ShoppingCart, Wallet } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";

import { getPersistedCart, removeCartLine, updateCartLine } from "@/app/(site)/cart/actions";
import { Breadcrumb } from "@/components/shared/breadcrumb";
import { Button } from "@/components/ui/button";
import { PageHeading } from "@/components/ui/page-heading";
import { CartThumbnail } from "@/components/features/orders/cart-thumbnail";
import { CartSkeleton } from "@/components/features/orders/cart-skeleton";
import { formatPeso } from "@/lib/catalog/currency";
import {
  readVisitorCart,
  writeVisitorCart,
} from "@/lib/orders/visitor-cart";
import { cartLineQuantityLimit } from "@/lib/orders/quantity";
import type { Cart, CartLine } from "@/lib/orders/cart";

type DisplayLine = Pick<CartLine, "id" | "sizeId" | "productSlug" | "productName" | "sizeLabel" | "imageUrl" | "priceInCentavos" | "quantity" | "available">;

function visitorCart(): Cart {
  const lines = readVisitorCart().map((line) => ({ ...line, imageUrl: line.imageUrl ?? null, id: line.sizeId, available: true }));
  return {
    lines,
    subtotalInCentavos: lines.reduce((subtotal, line) => subtotal + line.priceInCentavos * line.quantity, 0),
  };
}

export function CartView({ customerHasCart, initialCart }: { customerHasCart: boolean; initialCart: Cart }) {
  const [cart, setCart] = useState<Cart>(initialCart);
  const [ready, setReady] = useState(customerHasCart);
  const [message, setMessage] = useState<string>();
  const [pendingLineId, setPendingLineId] = useState<number>();
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!customerHasCart) {
      const timer = window.setTimeout(() => {
        setCart(visitorCart());
        setReady(true);
      }, 0);
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

    const next = readVisitorCart().map((visitorLine) => (
      visitorLine.sizeId === line.sizeId
        ? { ...visitorLine, quantity: Math.min(quantity, cartLineQuantityLimit) }
        : visitorLine
    ));
    writeVisitorCart(next);
    setCart(visitorCart());
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

    writeVisitorCart(readVisitorCart().filter((visitorLine) => visitorLine.sizeId !== line.sizeId));
    setCart(visitorCart());
    setPendingLineId(undefined);
  }

  if (!ready) return <CartSkeleton />;

  if (cart.lines.length === 0) {
    return (
      <section className="mx-auto flex max-w-[1440px] flex-col items-center gap-6 px-5 pb-32 pt-24 text-center sm:px-10 lg:pb-40 lg:pt-[140px]">
        <span className="grid size-24 place-items-center rounded-full bg-lavender text-primary">
          <ShoppingCart aria-hidden className="size-[43px]" />
        </span>
        <h1 className="font-serif text-4xl leading-[1.2] text-primary sm:text-[54px]">Your cart is empty</h1>
        <p className="max-w-[420px] leading-relaxed tracking-wide text-body">
          Freshly made ube jam, halaya and powder are waiting for you.
        </p>
        <Button asChild variant="pill" size="pill-lg">
          <Link href="/products">
            Shop our products
            <ArrowRight aria-hidden className="size-5" />
          </Link>
        </Button>
      </section>
    );
  }

  const itemCount = cart.lines.reduce((count, line) => count + line.quantity, 0);

  return (
    <section className="mx-auto flex max-w-[1440px] flex-col gap-10 px-5 pb-[100px] pt-10 sm:px-10 lg:pt-[60px]">
      <Breadcrumb crumbs={[{ label: "Home", href: "/" }, { label: "Cart" }]} />
      <PageHeading
        eyebrow="Your cart"
        title="Cart"
        aside={<p className="tracking-wide text-muted">{itemCount} {itemCount === 1 ? "item" : "items"}</p>}
      />
      <div className="flex flex-col gap-10 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1">
          <div className="hidden items-center gap-[30px] pb-4 text-xs font-medium uppercase tracking-[0.15em] text-muted sm:flex">
            <span className="flex-1">Product</span>
            <span className="w-[140px] text-center">Quantity</span>
            <span className="w-[120px] text-right">Total</span>
          </div>
          <ul className="divide-y divide-line border-y border-line">
            {cart.lines.map((line) => {
              const pending = isPending && pendingLineId === line.id;
              return (
                <li key={line.id} className="flex flex-wrap items-center gap-x-6 gap-y-4 py-7">
                  <CartThumbnail url={line.imageUrl} size={120} />
                  <div className="flex min-w-[140px] flex-1 flex-col items-start gap-1.5">
                    <Link
                      href={`/products/${line.productSlug}`}
                      className="font-serif text-[22px] leading-[1.3] text-ink hover:underline"
                    >
                      {line.productName}
                    </Link>
                    <p className="text-xs tracking-wide text-muted">
                      {line.sizeLabel} · {formatPeso(line.priceInCentavos)} each
                    </p>
                    {!line.available && <p className="text-sm font-medium text-warning">This Size is currently unavailable.</p>}
                    <Button type="button" variant="link" size="link-sm" disabled={pending} onClick={() => remove(line)}>
                      Remove
                    </Button>
                  </div>
                  <div className="flex w-[140px] justify-center">
                    <div className="flex items-center gap-2.5 rounded-full border border-line bg-white p-1">
                      <button
                        type="button"
                        aria-label={`Decrease ${line.productName} quantity`}
                        disabled={pending}
                        onClick={() => changeQuantity(line, line.quantity - 1)}
                        className="grid size-8 place-items-center rounded-full text-ink transition hover:bg-lavender-soft disabled:opacity-50"
                      >
                        <Minus aria-hidden className="size-3.5" />
                      </button>
                      <span aria-label={`${line.productName} quantity`} className="min-w-4 text-center text-sm font-medium tracking-wide text-ink">
                        {line.quantity}
                      </span>
                      <button
                        type="button"
                        aria-label={`Increase ${line.productName} quantity`}
                        disabled={pending || line.quantity === cartLineQuantityLimit}
                        onClick={() => changeQuantity(line, line.quantity + 1)}
                        className="grid size-8 place-items-center rounded-full text-ink transition hover:bg-lavender-soft disabled:opacity-50"
                      >
                        <Plus aria-hidden className="size-3.5" />
                      </button>
                    </div>
                  </div>
                  <p className="w-[120px] text-right tracking-wide text-ink">
                    {formatPeso(line.priceInCentavos * line.quantity)}
                  </p>
                </li>
              );
            })}
          </ul>
          <div className="pt-6">
            <Button asChild variant="link" size="link-sm">
              <Link href="/products">Continue shopping</Link>
            </Button>
          </div>
        </div>
        <aside
          aria-labelledby="order-summary-heading"
          className="flex w-full flex-col gap-6 rounded-[40px] border border-line bg-white p-8 sm:p-10 lg:w-[460px] lg:shrink-0"
        >
          <h2 id="order-summary-heading" className="font-serif text-[28px] leading-tight text-primary">Order summary</h2>
          <div className="flex items-center justify-between text-sm tracking-wide text-body">
            <span>Subtotal</span>
            <span>{formatPeso(cart.subtotalInCentavos)}</span>
          </div>
          <div className="flex items-center justify-between text-sm tracking-wide text-body">
            <span>Pickup</span>
            <span>Free</span>
          </div>
          <div className="flex items-center justify-between border-t border-line pt-6">
            <span className="text-sm font-medium tracking-wide text-ink">Total</span>
            <span className="font-serif text-[22px] leading-[1.3] text-primary">{formatPeso(cart.subtotalInCentavos)}</span>
          </div>
          <Button asChild variant="pill" size="pill-lg" className="w-full">
            <Link href="/checkout">
              Checkout
              <ArrowRight aria-hidden className="size-5" />
            </Link>
          </Button>
          <p className="flex items-center gap-2.5 text-xs tracking-wide text-muted">
            <Wallet aria-hidden className="size-[18px] shrink-0" />
            Pay with GCash or Cash on Delivery at the next step.
          </p>
        </aside>
      </div>
      {message && <p role="status" className="font-medium text-warning">{message}</p>}
    </section>
  );
}
