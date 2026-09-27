"use client";

import { useMemo, useState, useTransition } from "react";

import { addSizeToCart } from "@/app/(site)/cart/actions";
import { formatPeso } from "@/lib/catalog/currency";
import { cartLineQuantityLimit } from "@/lib/orders/quantity";
import { addVisitorCartLine } from "@/lib/orders/visitor-cart";

type Size = { id: number; label: string; priceInCentavos: number; available: boolean };

export function AddToCart({
  product,
  customerHasCart,
}: {
  product: { slug: string; name: string; sizes: Size[] };
  customerHasCart: boolean;
}) {
  const availableSizes = useMemo(() => product.sizes.filter(({ available }) => available), [product.sizes]);
  const [sizeId, setSizeId] = useState(availableSizes[0]?.id ?? 0);
  const [quantity, setQuantity] = useState(1);
  const [message, setMessage] = useState<string>();
  const [pending, startTransition] = useTransition();
  const selectedSize = availableSizes.find((size) => size.id === sizeId);

  function addToCart() {
    if (!selectedSize) return;
    setMessage(undefined);
    if (customerHasCart) {
      startTransition(async () => {
        try {
          await addSizeToCart(selectedSize.id, quantity);
          setMessage("Added to your Cart.");
        } catch {
          setMessage("We couldn't add that Size to your Cart. Please try again.");
        }
      });
      return;
    }

    addVisitorCartLine({
      sizeId: selectedSize.id,
      productSlug: product.slug,
      productName: product.name,
      sizeLabel: selectedSize.label,
      priceInCentavos: selectedSize.priceInCentavos,
      quantity,
    });
    setMessage("Added to your Cart.");
  }

  if (availableSizes.length === 0) {
    return <p className="mt-6 font-semibold text-on-surface-variant">All Sizes are currently unavailable.</p>;
  }

  return (
    <section className="mt-8 border-t border-outline-variant/60 pt-6" aria-labelledby="add-to-cart-heading">
      <h2 id="add-to-cart-heading" className="font-serif text-2xl text-primary">Add to Cart</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto]">
        <label className="grid gap-1.5 text-sm font-semibold text-on-surface">
          Size
          <select
            value={sizeId}
            onChange={(event) => setSizeId(Number(event.target.value))}
            className="border border-outline-variant bg-surface px-3 py-2.5 text-base"
          >
            {availableSizes.map((size) => (
              <option key={size.id} value={size.id}>
                {size.label} · {formatPeso(size.priceInCentavos)}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5 text-sm font-semibold text-on-surface">
          Quantity
          <input
            type="number"
            min="1"
            max={cartLineQuantityLimit}
            value={quantity}
            onChange={(event) => setQuantity(Math.min(cartLineQuantityLimit, Math.max(1, Number(event.target.value) || 1)))}
            className="w-24 border border-outline-variant bg-surface px-3 py-2.5 text-base"
          />
        </label>
      </div>
      <button
        type="button"
        onClick={addToCart}
        disabled={pending}
        className="mt-5 bg-primary px-5 py-3 font-semibold text-on-primary disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Adding…" : "Add to Cart"}
      </button>
      {message && <p role="status" className="mt-3 text-sm font-semibold text-on-surface-variant">{message}</p>}
    </section>
  );
}
