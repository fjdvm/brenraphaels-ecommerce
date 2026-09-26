import { cookies } from "next/headers";
import Link from "next/link";

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
  if (await isSignedIn()) {
    return (
      <div className={className}>
        <Link href="/profile" className="hover:text-primary">
          Profile
        </Link>
        <SignOutButton action={signOut} />
      </div>
    );
  }

  return (
    <div className={className}>
      <Link
        href="/signin"
        className="hover:text-primary hover:underline hover:underline-offset-4"
      >
        Sign in
      </Link>
    </div>
  );
}
