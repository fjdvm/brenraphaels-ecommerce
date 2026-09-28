"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState, useTransition } from "react";

import {
  addCheckoutAddress,
  placeOrder,
  type CheckoutAddressState,
} from "@/app/(site)/(protected)/checkout/actions";
import { LocationFields } from "@/components/features/auth/location-fields";
import {
  sanitizePostalCodeInput,
  sanitizeStreetInput,
} from "@/components/features/customer/input-sanitizers";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatPeso } from "@/lib/catalog/currency";
import type { CustomerAddress } from "@/lib/customer/visitor";
import type { Cart } from "@/lib/orders/cart";

const initialAddressState: CheckoutAddressState = {};

export function CheckoutView({
  cart,
  addresses,
  provinces,
}: {
  cart: Cart;
  addresses: CustomerAddress[];
  provinces: string[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string>();
  const [fulfillmentMethod, setFulfillmentMethod] = useState<"pickup" | "delivery">("pickup");
  const [addressId, setAddressId] = useState<number | undefined>(
    addresses.find((address) => address.isDefault)?.id ?? addresses[0]?.id,
  );

  function submitOrder() {
    setMessage(undefined);
    startTransition(async () => {
      try {
        await placeOrder({
          fulfillmentMethod,
          paymentMethod: "cash-on-delivery",
          addressId,
        });
        router.push("/profile/orders");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "We couldn't place your Order. Please try again.");
      }
    });
  }

  return (
    <section className="mx-auto max-w-4xl px-5 py-12 sm:px-8 lg:py-20">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-secondary">Checkout</p>
      <h1 className="mt-3 font-serif text-5xl text-primary">Review your Order</h1>
      {cart.lines.length === 0 ? (
        <div className="mt-10 border-y border-outline-variant/60 py-10">
          <p className="text-lg text-on-surface-variant">Your Cart is empty.</p>
          <Link className="mt-4 inline-block font-semibold text-primary underline underline-offset-4" href="/products">Shop our products</Link>
        </div>
      ) : (
        <>
          <div className="mt-10 grid gap-8 md:grid-cols-2">
            <section aria-labelledby="items-heading">
              <h2 id="items-heading" className="font-serif text-2xl text-primary">Your Cart</h2>
              <ul className="mt-4 divide-y divide-outline-variant/60 border-y border-outline-variant/60">
                {cart.lines.map((line) => (
                  <li key={line.id} className="py-4">
                    <p className="font-semibold text-primary">{line.productName}</p>
                    <p className="mt-1 text-sm text-on-surface-variant">{line.sizeLabel} · {line.quantity} × {formatPeso(line.priceInCentavos)}</p>
                    {!line.available && <p className="mt-1 text-sm font-semibold text-secondary">This Size is currently unavailable.</p>}
                  </li>
                ))}
              </ul>
              <p className="mt-4 flex justify-between font-bold text-primary"><span>Subtotal</span><span>{formatPeso(cart.subtotalInCentavos)}</span></p>
              {fulfillmentMethod === "delivery" ? <p className="mt-2 text-sm font-semibold text-secondary">Delivery fee and final total will be confirmed after you place your Order.</p> : null}
            </section>
            <section aria-labelledby="choices-heading">
              <h2 id="choices-heading" className="font-serif text-2xl text-primary">Your choices</h2>
              <fieldset className="mt-4 space-y-3 rounded-md border border-outline-variant/60 p-5">
                <legend className="font-semibold text-on-surface">Fulfillment method</legend>
                <Choice checked={fulfillmentMethod === "pickup"} description="Collect your Order. There is no Delivery fee." label="Pickup" name="fulfillment" onChange={() => setFulfillmentMethod("pickup")} value="pickup" />
                <Choice checked={fulfillmentMethod === "delivery"} description="Have your Order delivered to one of your saved Addresses." label="Delivery" name="fulfillment" onChange={() => setFulfillmentMethod("delivery")} value="delivery" />
              </fieldset>
              {fulfillmentMethod === "delivery" ? <DeliveryAddressChoice addresses={addresses} addressId={addressId} onAddressIdChange={setAddressId} provinces={provinces} /> : null}
              <dl className="mt-4 rounded-md border border-outline-variant/60 p-5">
                <dt className="text-sm font-semibold text-on-surface-variant">Payment method</dt>
                <dd className="mt-1 font-semibold text-primary">Cash on Delivery</dd>
                <p className="mt-1 text-sm text-on-surface-variant">
                  {fulfillmentMethod === "pickup"
                    ? "Pay cash when you collect your Order."
                    : "Pay cash when your Order is delivered."}
                </p>
              </dl>
            </section>
          </div>
          {message && <p role="alert" className="mt-6 font-semibold text-secondary">{message}</p>}
          <div className="mt-8 flex flex-wrap gap-4">
            <Button disabled={isPending || cart.lines.some((line) => !line.available) || (fulfillmentMethod === "delivery" && !addressId)} onClick={submitOrder} size="lg" type="button">
              {isPending ? "Placing Order…" : "Place Order"}
            </Button>
            <Button asChild size="lg" variant="outline"><Link href="/cart">Edit Cart</Link></Button>
          </div>
        </>
      )}
    </section>
  );
}

function Choice({ checked, description, label, name, onChange, value }: { checked: boolean; description: string; label: string; name: string; onChange: () => void; value: string }) {
  return <label className="flex cursor-pointer items-start gap-3"><input checked={checked} className="mt-1" name={name} onChange={onChange} type="radio" value={value} /><span><span className="font-semibold text-primary">{label}</span><span className="mt-1 block text-sm text-on-surface-variant">{description}</span></span></label>;
}

function DeliveryAddressChoice({ addresses, addressId, onAddressIdChange, provinces }: { addresses: CustomerAddress[]; addressId?: number; onAddressIdChange: (id: number) => void; provinces: string[] }) {
  return <div className="mt-4 rounded-md border border-outline-variant/60 p-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold text-on-surface">Delivery Address</h3><AddAddressDialog onAddressAdded={onAddressIdChange} provinces={provinces} /></div>
    {addresses.length === 0 ? <p className="mt-3 text-sm text-secondary">Add an Address before placing a Delivery Order.</p> : <div className="mt-3 space-y-3">
      {addresses.map((address) => <label className="flex cursor-pointer items-start gap-3" key={address.id}><input checked={address.id === addressId} name="delivery-address" onChange={() => onAddressIdChange(address.id)} type="radio" value={address.id} /><span className="text-sm text-on-surface"><span className="font-semibold">{address.label}{address.isDefault ? " (Default)" : ""}</span><span className="mt-1 block text-on-surface-variant">{address.street}, {address.barangay}, {address.city}, {address.province} {address.postalCode}</span></span></label>)}
    </div>}
    <p className="mt-4 text-sm font-semibold text-secondary">Your Delivery fee and final total will be confirmed after placing your Order.</p>
  </div>;
}

function AddAddressDialog({ onAddressAdded, provinces }: { onAddressAdded: (id: number) => void; provinces: string[] }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(addCheckoutAddress, initialAddressState);
  useEffect(() => { if (state.addressId) { onAddressAdded(state.addressId); router.refresh(); } }, [onAddressAdded, router, state.addressId]);
  const streetError = state.fieldErrors?.street?.[0];
  const postalError = state.fieldErrors?.postalCode?.[0];
  return <Dialog><DialogTrigger asChild><Button type="button" variant="outline">Add an Address</Button></DialogTrigger><DialogContent><DialogTitle className="font-serif text-3xl text-primary">Add an Address</DialogTitle><DialogDescription className="mt-2 text-on-surface-variant">Save a new Address and use it for this Delivery Order.</DialogDescription><form action={action} className="mt-6 grid gap-4 sm:grid-cols-2"><div className="sm:col-span-2"><Label htmlFor="checkout-label" required>Label</Label><select className="mt-1 h-11 w-full border border-input bg-white px-3" defaultValue="Home" id="checkout-label" name="label"><option>Home</option><option>Work</option><option>Other</option></select></div><div className="sm:col-span-2"><Label htmlFor="checkout-street" required>Street address</Label><Input aria-describedby={streetError ? "checkout-street-error" : undefined} aria-invalid={Boolean(streetError)} autoComplete="street-address" id="checkout-street" name="street" onInput={sanitizeStreetInput} required />{streetError ? <p className="mt-1 text-sm text-red-700" id="checkout-street-error" role="alert">{streetError}</p> : null}</div><LocationFields errors={state.fieldErrors ?? {}} idSuffix="-checkout" provinces={provinces} /><div><Label htmlFor="postalCode-checkout" required>Postal code</Label><Input aria-describedby={postalError ? "postalCode-checkout-error" : undefined} aria-invalid={Boolean(postalError)} autoComplete="postal-code" id="postalCode-checkout" inputMode="numeric" maxLength={4} name="postalCode" onInput={sanitizePostalCodeInput} required />{postalError ? <p className="mt-1 text-sm text-red-700" id="postalCode-checkout-error" role="alert">{postalError}</p> : null}</div><p className="text-sm text-on-surface-variant sm:col-span-2">Country: Philippines</p><Button disabled={pending} type="submit">{pending ? "Adding…" : "Add Address"}</Button></form></DialogContent></Dialog>;
}
