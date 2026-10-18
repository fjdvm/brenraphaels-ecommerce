import Link from "next/link";
import { ShoppingCart, User } from "lucide-react";

import { initialsOf } from "@/lib/customer/initials";
import type { Visitor } from "@/lib/customer/visitor";

export function SessionNav({ className, visitor, showCart = true }: { className?: string; visitor: Visitor; showCart?: boolean }) {
  return (
    <div className={className}>
      {showCart && (
        <Link href="/cart" aria-label="Cart" className="hover:text-primary">
          <ShoppingCart size={20} />
        </Link>
      )}
      {visitor.state === "needs-details" ? (
        <>
          <Link href="/profile" aria-label="Profile" className="hover:text-primary">
            <User size={20} />
          </Link>
        </>
      ) : visitor.state === "signed-out" ? (
        <Link
          href="/signin"
          className="hover:text-primary hover:underline hover:underline-offset-4"
        >
          Sign in
        </Link>
      ) : (
        <Link href="/profile" className="flex items-center gap-2.5 hover:text-primary">
          <span
            aria-hidden
            className="flex size-9 items-center justify-center rounded-full bg-primary text-[13px] font-medium tracking-[0.35px] text-white"
          >
            {initialsOf(visitor.customer.fullName)}
          </span>
          <span className="tracking-[0.35px]">{visitor.customer.firstName}</span>
        </Link>
      )}
    </div>
  );
}
