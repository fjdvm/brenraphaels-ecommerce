import Link from "next/link";
import { Bell, LogOut, ShoppingCart, User } from "lucide-react";

import { signOut } from "@/app/actions";
import { AccountMenu, MobileAccountMenu } from "@/components/shared/account-menu";
import { SignOutButton } from "@/components/shared/sign-out-button";
import { initialsOf } from "@/lib/customer/initials";
import type { Visitor } from "@/lib/customer/visitor";

export function SessionNav({ className, visitor, showCart = true }: { className?: string; visitor: Visitor; showCart?: boolean }) {
  const initials = visitor.state === "customer" ? initialsOf(visitor.customer.fullName) : "";
  const signOutButton = (
    <SignOutButton
      action={signOut}
      icon={<LogOut aria-hidden className="size-[18px]" strokeWidth={1.5} />}
      className={
        showCart
          ? "flex w-full items-center gap-3 px-5 py-2.5 text-left font-normal hover:bg-surface-container-low hover:no-underline"
          : "flex items-center gap-3 py-2.5 text-left text-sm font-semibold text-on-surface-variant hover:no-underline"
      }
    />
  );
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
        <>
          {showCart && (
            <Link href="/profile/notifications" aria-label="Notifications" className="flex items-center hover:text-primary">
              <Bell size={20} />
            </Link>
          )}
          {showCart ? (
            <AccountMenu initials={initials} firstName={visitor.customer.firstName} signOut={signOutButton} />
          ) : (
            <MobileAccountMenu initials={initials} firstName={visitor.customer.firstName} signOut={signOutButton} />
          )}
        </>
      )}
    </div>
  );
}
