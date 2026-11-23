"use client";

import { Minus, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { StockCount } from "@/components/features/catalog/stock-count";
import { formatPeso } from "@/lib/catalog/currency";
import { addProductSizeToCart } from "@/lib/orders/add-product-size";
import { cartLineQuantityLimit } from "@/lib/orders/quantity";

type Size = { id: number; label: string; priceInCentavos: number; available: boolean; left?: number | null };

export function AddToCart({
  product,
  customerHasCart,
}: {
  product: { slug: string; name: string; image?: string; sizes: Size[] };
  customerHasCart: boolean;
}) {
  const router = useRouter();
  const availableSizes = useMemo(() => product.sizes.filter(({ available }) => available), [product.sizes]);
  const [sizeId, setSizeId] = useState(availableSizes[0]?.id ?? 0);
  const [quantity, setQuantity] = useState(1);
  const [message, setMessage] = useState<string>();
  const [pendingAction, setPendingAction] = useState<"cart" | "buy">();
  const [pending, startTransition] = useTransition();
  const selectedSize = availableSizes.find((size) => size.id === sizeId);

  /** Adds the selected Size and quantity to the Cart, reporting whether it succeeded. */
  async function addToCart() {
    if (!selectedSize) return false;
    try {
      await addProductSizeToCart({ customerHasCart, product, size: selectedSize, quantity });
      return true;
    } catch {
      setMessage("We couldn't add that Size to your Cart. Please try again.");
      return false;
    }
  }

  function handleAddToCart() {
    setMessage(undefined);
    setPendingAction("cart");
    startTransition(async () => {
      if (await addToCart()) setMessage("Added to your Cart.");
    });
  }

  function handleBuyNow() {
    setMessage(undefined);
    setPendingAction("buy");
    startTransition(async () => {
      if (await addToCart()) router.push("/cart");
    });
  }

  function changeQuantity(next: number) {
    setQuantity(Math.min(cartLineQuantityLimit, Math.max(1, next)));
  }

  if (availableSizes.length === 0) {
    return <p className="font-medium text-muted">All Sizes are currently unavailable.</p>;
  }

  return (
    <section className="flex flex-col gap-[30px]" aria-labelledby="add-to-cart-heading">
      <h2 id="add-to-cart-heading" className="sr-only">Add to Cart</h2>
      <fieldset className="flex flex-col gap-3.5">
        <legend className="mb-3.5 text-[13px] font-medium tracking-wide text-ink">Size</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {availableSizes.map((size) => {
            const selected = size.id === sizeId;
            return (
              <label
                key={size.id}
                className={`flex flex-col gap-0.5 px-6 py-4 transition has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary ${
                  selected
                      ? "cursor-pointer border-2 border-primary bg-lavender-soft"
                      : "cursor-pointer border border-line bg-white hover:border-primary"
                }`}
              >
                <input
                  type="radio"
                  name="size"
                  className="sr-only"
                  checked={selected}
                  onChange={() => setSizeId(size.id)}
                />
                <span className="text-sm font-medium text-ink">{size.label}</span>
                <span className="text-xs text-muted">{formatPeso(size.priceInCentavos)}</span>
                <StockCount left={size.left} />
              </label>
            );
          })}
        </div>
      </fieldset>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-4 rounded-full border border-line bg-white px-2 py-1.5">
          <button
            type="button"
            aria-label="Decrease quantity"
            disabled={quantity <= 1}
            onClick={() => changeQuantity(quantity - 1)}
            className="grid size-11 place-items-center rounded-full text-ink transition hover:bg-lavender-soft disabled:opacity-40"
          >
            <Minus aria-hidden className="size-5" />
          </button>
          <span aria-label="Quantity" className="min-w-4 text-center tracking-wide text-ink">{quantity}</span>
          <button
            type="button"
            aria-label="Increase quantity"
            disabled={quantity >= cartLineQuantityLimit}
            onClick={() => changeQuantity(quantity + 1)}
            className="grid size-11 place-items-center rounded-full text-ink transition hover:bg-lavender-soft disabled:opacity-40"
          >
            <Plus aria-hidden className="size-5" />
          </button>
        </div>
        <Button
          type="button"
          variant="pill"
          size="pill-lg"
          className="min-w-0 flex-1"
          onClick={handleAddToCart}
          disabled={pending}
        >
          {pending && pendingAction === "cart"
            ? "Adding…"
            : (
              <>
                Add to cart
                <span className="hidden sm:inline">
                  {" — "}
                  {formatPeso((selectedSize?.priceInCentavos ?? 0) * quantity)}
                </span>
              </>
            )}
        </Button>
      </div>
      <Button
        type="button"
        variant="pill-outline"
        size="pill-lg"
        className="w-full"
        onClick={handleBuyNow}
        disabled={pending}
      >
        {pending && pendingAction === "buy" ? "Adding…" : "Buy now"}
      </Button>
      {message && <p role="status" className="-mt-4 text-sm font-medium text-body">{message}</p>}
    </section>
  );
}
