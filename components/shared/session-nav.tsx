import Link from "next/link";
import { Bell, LogOut, ShoppingCart, User } from "lucide-react";

import { signOut } from "@/app/actions";
import { AccountMenu } from "@/components/shared/account-menu";
import { accountMenuItems } from "@/components/shared/account-menu-items";
import { SignOutButton } from "@/components/shared/sign-out-button";
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
        <>
          <Link
            href="/profile/notifications"
            aria-label={showCart ? "Notifications" : undefined}
            className="flex items-center gap-2.5 hover:text-primary"
          >
            <Bell size={20} />
            {!showCart && "Notifications"}
          </Link>
          {showCart ? (
            <AccountMenu initials={initialsOf(visitor.customer.fullName)} firstName={visitor.customer.firstName}
              signOut={
                <SignOutButton
                  action={signOut}
                  icon={<LogOut aria-hidden className="size-[18px]" strokeWidth={1.5} />}
                  className="flex w-full items-center gap-3 px-5 py-2.5 text-left font-normal hover:bg-surface-container-low hover:no-underline"
                />
              }
            />
          ) : (
            accountMenuItems.map(({ href, label }) => (
              <Link key={href} href={href} className="hover:text-primary">
                {label}
              </Link>
            ))
          )}
        </>
      )}
    </div>
  );
}
