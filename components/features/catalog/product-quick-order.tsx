"use client";

import { ShoppingCart, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { formatPeso } from "@/lib/catalog/currency";
import { addProductSizeToCart } from "@/lib/orders/add-product-size";

type Size = { id: number; label: string; priceInCentavos: number; available: boolean };
type Intent = "cart" | "buy";

/**
 * Add to Cart / Buy Now for a Product card, always at quantity 1. With more
 * than one available Size it asks which one first; with exactly one, it acts
 * immediately since there is nothing to choose.
 */
export function ProductQuickOrder({
  product,
  customerHasCart,
}: {
  product: { slug: string; name: string; sizes: Size[] };
  customerHasCart: boolean;
}) {
  const router = useRouter();
  const availableSizes = product.sizes.filter((size) => size.available);
  const [open, setOpen] = useState(false);
  const [intent, setIntent] = useState<Intent>("cart");
  const [sizeId, setSizeId] = useState(availableSizes[0]?.id ?? 0);
  const [message, setMessage] = useState<string>();
  const [pending, startTransition] = useTransition();

  if (availableSizes.length === 0) return null;

  function commit(size: Size, action: Intent) {
    setMessage(undefined);
    startTransition(async () => {
      try {
        await addProductSizeToCart({ customerHasCart, product, size, quantity: 1 });
        if (action === "buy") {
          router.push("/cart");
          return;
        }
        setOpen(false);
        setMessage("Added to your Cart.");
      } catch {
        setMessage("We couldn't add that Size to your Cart. Please try again.");
      }
    });
  }

  function start(action: Intent) {
    if (availableSizes.length === 1) {
      commit(availableSizes[0], action);
      return;
    }
    setIntent(action);
    setSizeId(availableSizes[0].id);
    setMessage(undefined);
    setOpen(true);
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Add to Cart"
          title="Add to Cart"
          onClick={() => start("cart")}
          disabled={pending}
          className="grid size-10 place-items-center border border-outline-variant text-primary transition hover:border-primary hover:bg-primary hover:text-on-primary disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ShoppingCart aria-hidden className="size-4" />
        </button>
        <button
          type="button"
          aria-label="Buy Now"
          title="Buy Now"
          onClick={() => start("buy")}
          disabled={pending}
          className="grid size-10 place-items-center bg-primary text-on-primary transition hover:bg-primary-container disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Zap aria-hidden className="size-4" />
        </button>
        {message && !open && (
          <p role="status" className="text-xs font-semibold text-on-surface-variant">
            {message}
          </p>
        )}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle className="font-serif text-2xl text-primary">Choose a Size</DialogTitle>
          <DialogDescription className="mt-1 text-on-surface-variant">{product.name}</DialogDescription>
          <div className="mt-6 grid gap-2">
            {availableSizes.map((size) => (
              <button
                key={size.id}
                type="button"
                onClick={() => setSizeId(size.id)}
                className={`flex items-center justify-between border px-4 py-3 text-left font-semibold transition ${
                  size.id === sizeId
                    ? "border-primary bg-primary-fixed text-primary"
                    : "border-outline-variant text-on-surface hover:border-primary"
                }`}
              >
                <span>{size.label}</span>
                <span>{formatPeso(size.priceInCentavos)}</span>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              const size = availableSizes.find((candidate) => candidate.id === sizeId);
              if (size) commit(size, intent);
            }}
            disabled={pending}
            className="mt-6 w-full bg-primary px-5 py-3 font-semibold text-on-primary disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? "Adding…" : intent === "buy" ? "Buy Now" : "Add to Cart"}
          </button>
          {message && <p role="status" className="mt-3 text-sm font-semibold text-on-surface-variant">{message}</p>}
        </DialogContent>
      </Dialog>
    </>
  );
}
