"use client";

import { addSizeToCart } from "@/app/(site)/cart/actions";

import { addVisitorCartLine } from "./visitor-cart";

/**
 * Adds one Size of a Product to the Cart: the Customer's persisted Cart when
 * they have one, otherwise the signed-out Visitor's local Cart. Shared by
 * every "Add to Cart" / "Buy Now" control so they all add a line the same way.
 */
export async function addProductSizeToCart({
  customerHasCart,
  product,
  size,
  quantity,
}: {
  customerHasCart: boolean;
  product: { slug: string; name: string };
  size: { id: number; label: string; priceInCentavos: number };
  quantity: number;
}) {
  if (customerHasCart) {
    await addSizeToCart(size.id, quantity);
    return;
  }

  addVisitorCartLine({
    sizeId: size.id,
    productSlug: product.slug,
    productName: product.name,
    sizeLabel: size.label,
    priceInCentavos: size.priceInCentavos,
    quantity,
  });
}
