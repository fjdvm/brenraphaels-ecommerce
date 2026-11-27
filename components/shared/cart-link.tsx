"use client";

import { ShoppingCart } from "lucide-react";
import Link from "next/link";
import { useSyncExternalStore } from "react";

import { CountBadge } from "@/components/shared/count-badge";
import { readVisitorCart, subscribeToVisitorCart } from "@/lib/orders/visitor-cart";

const visitorCartCount = () => readVisitorCart().reduce((count, line) => count + line.quantity, 0);
const noCount = () => 0;

/** The cart icon: a link to the Cart, badged with how many units are in it. */
export function CartLink({
  className,
  size,
  customerCount,
}: {
  className?: string;
  size?: number;
  /** The signed-in Customer's count; leave it out to count the browser's Visitor Cart. */
  customerCount?: number;
}) {
  const visitorCount = useSyncExternalStore(subscribeToVisitorCart, visitorCartCount, noCount);
  const count = customerCount ?? visitorCount;

  return (
    <Link
      href="/cart"
      aria-label={count > 0 ? `Cart, ${count} ${count === 1 ? "item" : "items"}` : "Cart"}
      className={className}
    >
      <span className="relative flex">
        <ShoppingCart size={size} />
        <CountBadge count={count} />
      </span>
    </Link>
  );
}
