import { requireCustomer } from "@/lib/customer/current-visitor";

// Every page in this group needs a signed-in Customer with saved details. The
// proxy only does a fast cookie check; this is the real check.
export default async function ProtectedLayout({ children }: LayoutProps<"/">) {
  await requireCustomer();
  return children;
}
