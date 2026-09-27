import { cookies } from "next/headers";
import Link from "next/link";
import { ShoppingCart, User } from "lucide-react";

import { signOut } from "@/app/actions";
import { SignOutButton } from "@/components/shared/sign-out-button";
import { hasSessionCookie } from "@/lib/auth/route-access";
import { getVisitorSession } from "@/lib/neon-auth/server";

async function isSignedIn() {
  const cookieStore = await cookies();
  if (!hasSessionCookie(cookieStore.getAll())) {
    return false;
  }

  try {
    return (await getVisitorSession()) !== null;
  } catch {
    // A public page should still render if Neon Auth cannot be reached.
    return false;
  }
}

export async function SessionNav({ className }: { className?: string }) {
  const signedIn = await isSignedIn();
  return (
    <div className={className}>
      <Link href="/cart" aria-label="Cart" className="hover:text-primary">
        <ShoppingCart size={20} />
      </Link>
      {signedIn ? (
        <>
          <Link href="/profile" aria-label="Profile" className="hover:text-primary">
            <User size={20} />
          </Link>
          <SignOutButton action={signOut} />
        </>
      ) : (
        <Link
          href="/signin"
          className="hover:text-primary hover:underline hover:underline-offset-4"
        >
          Sign in
        </Link>
      )}
    </div>
  );
}
