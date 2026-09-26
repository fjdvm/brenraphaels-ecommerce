import { redirect } from "next/navigation";

import { currentVisitor } from "@/lib/customer/current-visitor";

// Sign-in, sign-up and password pages are for signed-out visitors only. The
// real session is checked here, so a stale cookie never traps anyone.
export default async function GuestLayout({ children }: LayoutProps<"/">) {
  const visitor = await currentVisitor();
  if (visitor.state === "customer") {
    redirect("/");
  }
  if (visitor.state === "needs-details") {
    redirect("/complete-profile");
  }

  return children;
}
