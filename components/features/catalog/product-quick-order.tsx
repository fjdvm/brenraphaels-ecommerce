"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
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
      <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1">
        <Button type="button" variant="pill-outline" size="pill-sm" onClick={() => start("cart")} disabled={pending}>
          Add to cart
        </Button>
        <Button type="button" variant="link" size="link-sm" onClick={() => start("buy")} disabled={pending}>
          Buy now
        </Button>
        {message && !open && (
          <p role="status" className="w-full text-right text-xs font-semibold text-muted">
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
                className={`flex items-center justify-between rounded-[3px] border-2 px-5 py-3.5 text-left font-medium transition ${
                  size.id === sizeId
                    ? "border-primary bg-lavender-soft text-ink"
                    : "border-line text-ink hover:border-primary"
                }`}
              >
                <span>{size.label}</span>
                <span>{formatPeso(size.priceInCentavos)}</span>
              </button>
            ))}
          </div>
          <Button
            type="button"
            variant="pill"
            size="pill-lg"
            className="mt-6 w-full"
            onClick={() => {
              const size = availableSizes.find((candidate) => candidate.id === sizeId);
              if (size) commit(size, intent);
            }}
            disabled={pending}
          >
            {pending ? "Adding…" : intent === "buy" ? "Buy Now" : "Add to Cart"}
          </Button>
          {message && <p role="status" className="mt-3 text-sm font-semibold text-on-surface-variant">{message}</p>}
        </DialogContent>
      </Dialog>
    </>
  );
}
