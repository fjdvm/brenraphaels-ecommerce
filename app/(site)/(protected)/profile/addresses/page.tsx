import type { Metadata } from "next";
import { AddressForms } from "@/components/features/customer/address-forms";
import { Card } from "@/components/ui/card";
import { listProvinces } from "@/lib/address/locations";
import { requireCustomer } from "@/lib/customer/current-visitor";
export const metadata: Metadata = { title: "Address book" };
export default async function AddressBookPage() {
  const customer = await requireCustomer();
  return (
    <Card className="p-6 shadow-sm sm:p-10">
      <h2 className="font-serif text-3xl text-primary">My address book</h2>
      <p className="mt-2 text-on-surface-variant">
        Manage the delivery addresses saved to your account.
      </p>
      <AddressForms
        addresses={customer.addresses}
        provinces={listProvinces()}
      />
    </Card>
  );
}
