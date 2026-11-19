"use client";

import { FEE_TO_FOLLOW_COPY } from "@/lib/orders/fee-to-follow-copy";
import { FREE_DELIVERY_CONFIRMATION_NOTICE, qualifiesForFreeDelivery } from "@/lib/orders/free-delivery";
import { ArrowRight, Check, MapPin, Package, Plus, Store, Truck, Wallet } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState, useTransition } from "react";

import {
  addCheckoutAddress,
  placeOrder,
  type CheckoutAddressState,
} from "@/app/(site)/(protected)/checkout/actions";
import { PsgcAddressFields } from "@/components/features/address/psgc-address-fields";
import {
  sanitizePostalCodeInput,
  sanitizeStreetInput,
} from "@/components/features/customer/input-sanitizers";
import { Breadcrumb } from "@/components/shared/breadcrumb";
import { Button } from "@/components/ui/button";
import { CartThumbnail } from "@/components/features/orders/cart-thumbnail";
import { PageHeading } from "@/components/ui/page-heading";
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
import { formatAddressLine } from "@/lib/address/format";
import type { CustomerAddress } from "@/lib/customer/visitor";
import type { Cart } from "@/lib/orders/cart";
import type { PaymentMethod } from "@/lib/orders/orders";
import { PAYMENT_LABELS } from "@/lib/orders/payment-details";

const PREPAID = [
  { method: "gcash", icon: Wallet, description: "After placing your order, submit your GCash reference number in My orders." },
  { method: "maya", icon: Wallet, description: "After placing your order, submit your Maya reference number in My orders." },
  { method: "bank-transfer", icon: Wallet, description: "After placing your order, submit your bank transfer reference number in My orders." },
] as const;

const initialAddressState: CheckoutAddressState = {};

export function CheckoutView({
  cart,
  addresses,
  seniorPwdDiscount = null,
  freeDeliveryThresholdInCentavos = null,
}: {
  cart: Cart;
  addresses: CustomerAddress[];
  /** Where each prepaid method is paid, as the shop set it. */
  /**
   * The Senior/PWD discount a Customer with an approved ID gets automatically, as the CREOMS rule prices it on this Cart:
   * `label` is the rule ("5% off"), `discountInCentavos` is what it takes off one unit of the priciest item.
   */
  seniorPwdDiscount?: { label: string; discountInCentavos: number } | null;
  /** The shop's current Free delivery threshold; null when it could not be read, so no promise is made. */
  freeDeliveryThresholdInCentavos?: number | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string>();
  const [confirming, setConfirming] = useState(false);
  const [fulfillmentMethod, setFulfillmentMethod] = useState<"pickup" | "delivery">("pickup");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash-on-delivery");
  const [addressId, setAddressId] = useState<number | undefined>(
    addresses.find((address) => address.isDefault)?.id ?? addresses[0]?.id,
  );

  const discount = seniorPwdDiscount?.discountInCentavos ?? 0;
  const total = cart.subtotalInCentavos - discount;
  // Judged on the subtotal after discounts, exactly as on the server.
  const freeDelivery = fulfillmentMethod === "delivery"
    && qualifiesForFreeDelivery(cart.subtotalInCentavos - discount, freeDeliveryThresholdInCentavos);

  function submitOrder() {
    setMessage(undefined);
    startTransition(async () => {
      try {
        const { orderId } = await placeOrder({
          fulfillmentMethod,
          paymentMethod,
          addressId,
        });
        router.push(`/checkout/placed/${orderId}`);
      } catch (error) {
        setConfirming(false);
        setMessage(error instanceof Error ? error.message : "We couldn't place your Order. Please try again.");
      }
    });
  }

  const selectedAddress = addresses.find((address) => address.id === addressId);
  const deliveryBlocked = fulfillmentMethod === "delivery" && !addressId;

  if (cart.lines.length === 0) {
    return (
      <section className="mx-auto flex max-w-[1440px] flex-col items-center gap-6 px-5 pb-32 pt-24 text-center sm:px-10 lg:pt-[140px]">
        <h1 className="font-serif text-4xl leading-[1.2] text-primary sm:text-[54px]">Your cart is empty</h1>
        <p className="max-w-[420px] leading-relaxed tracking-wide text-body">
          Add something from our shop before checking out.
        </p>
        <Button asChild variant="pill" size="pill-lg">
          <Link href="/products">
            Shop our products
            <ArrowRight aria-hidden className="size-5" />
          </Link>
        </Button>
      </section>
    );
  }

  return (
    <section className="mx-auto flex max-w-[1440px] flex-col gap-10 px-5 pb-[100px] pt-10 sm:px-10 lg:pt-[60px]">
      <Breadcrumb crumbs={[{ label: "Home", href: "/" }, { label: "Cart", href: "/cart" }, { label: "Checkout" }]} />
      <PageHeading eyebrow="Almost there" title="Checkout" aside={<CheckoutSteps />} />
      <div className="flex flex-col gap-10 lg:flex-row lg:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-6">
          <Panel title="1. How would you like to get your order?">
            <fieldset className="grid gap-4 sm:grid-cols-2">
              <legend className="sr-only">Fulfillment method</legend>
              <Choice
                checked={fulfillmentMethod === "pickup"}
                description="Collect your Order. There is no Delivery fee."
                icon={Store}
                label="Store pickup"
                name="fulfillment"
                onChange={() => setFulfillmentMethod("pickup")}
                value="pickup"
              />
              <Choice
                checked={fulfillmentMethod === "delivery"}
                description="Free for orders over ₱2,500"
                icon={Truck}
                label="Delivery"
                name="fulfillment"
                onChange={() => setFulfillmentMethod("delivery")}
                value="delivery"
              />
            </fieldset>
          </Panel>
          {fulfillmentMethod === "delivery" ? (
            <DeliveryAddressChoice addresses={addresses} addressId={addressId} onAddressIdChange={setAddressId} />
          ) : null}
          <Panel title={`${fulfillmentMethod === "delivery" ? "3" : "2"}. Payment method`}>
            <fieldset className="grid gap-4 sm:grid-cols-2">
              <legend className="sr-only">Payment method</legend>
              {PREPAID.map(({ method, icon, description }) => (
                <Choice
                  checked={paymentMethod === method}
                  description={description}
                  icon={icon}
                  key={method}
                  label={PAYMENT_LABELS[method]}
                  name="payment"
                  onChange={() => setPaymentMethod(method)}
                  value={method}
                />
              ))}
              <Choice
                checked={paymentMethod === "cash-on-delivery"}
                description={fulfillmentMethod === "pickup" ? "Pay cash when you collect your Order." : "Pay cash when your Order is delivered."}
                icon={Package}
                label="Cash on Delivery"
                name="payment"
                onChange={() => setPaymentMethod("cash-on-delivery")}
                value="cash-on-delivery"
              />
            </fieldset>
            {paymentMethod !== "cash-on-delivery" ? <p className="text-sm tracking-[0.35px] text-body" data-testid="pending-confirmation-note">Your Order will show Pending Confirmation. Once the shop confirms it, we show where to pay.</p> : null}
          </Panel>
        </div>
        <aside
          aria-labelledby="checkout-summary-heading"
          className="flex w-full flex-col gap-[22px] border border-line bg-white p-8 sm:p-10 lg:w-[460px] lg:shrink-0"
        >
          <h2 id="checkout-summary-heading" className="font-serif text-[28px] leading-tight text-primary">Order summary</h2>
          <ul className="flex flex-col gap-4">
            {cart.lines.map((line) => (
              <li key={line.id} className="flex items-center gap-4 tracking-wide">
                <CartThumbnail url={line.imageUrl} size={64} />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5 leading-normal">
                  <p className="text-sm font-medium text-ink">{line.productName}</p>
                  <p className="text-xs text-muted">{line.sizeLabel} × {line.quantity}</p>
                  {!line.available && <p className="text-xs font-medium text-warning">{line.blockedReason ?? "This Size is currently unavailable."}</p>}
                </div>
                <p className="text-sm font-medium text-ink">{formatPeso(line.priceInCentavos * line.quantity)}</p>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between border-t border-line pt-[22px] text-sm tracking-wide text-body">
            <span>Subtotal</span>
            <span>{formatPeso(cart.subtotalInCentavos)}</span>
          </div>
          {discount > 0 ? (
            <div className="flex items-center justify-between text-sm tracking-wide text-body">
              <span>Senior/PWD {seniorPwdDiscount?.label} · 1 item</span>
              <span className="text-success">−{formatPeso(discount)}</span>
            </div>
          ) : null}
          <div className="flex items-center justify-between text-sm tracking-wide text-body">
            <span>{fulfillmentMethod === "delivery" ? "Delivery" : "Pickup"}</span>
            {fulfillmentMethod === "delivery" && !freeDelivery ? <span className="text-warning">To be confirmed</span> : <span className={freeDelivery ? "text-success" : undefined}>{freeDelivery ? "Delivery: Free" : "Free"}</span>}
          </div>
          <div className="flex items-center justify-between border-t border-line pt-[22px]">
            <span className="text-sm font-medium tracking-wide text-ink">Total</span>
            <span className="font-serif text-[22px] leading-[1.3] text-primary">
              {formatPeso(total)}{fulfillmentMethod === "delivery" && !freeDelivery ? " + delivery" : ""}
            </span>
          </div>
          {fulfillmentMethod === "delivery" ? (
            <p className="flex items-start gap-2.5 bg-warning-soft p-4 text-xs leading-normal tracking-wide text-ink">
              <Truck aria-hidden className="size-[18px] shrink-0 text-warning" />
              {freeDelivery ? FREE_DELIVERY_CONFIRMATION_NOTICE : FEE_TO_FOLLOW_COPY}
            </p>
          ) : null}
          {message && <p role="alert" className="text-sm font-medium text-warning">{message}</p>}
          <Button
            className="w-full"
            disabled={isPending || cart.lines.some((line) => !line.available) || deliveryBlocked}
            onClick={() => setConfirming(true)}
            size="pill-lg"
            type="button"
            variant="pill"
          >
            Place order
            <ArrowRight aria-hidden className="size-5" />
          </Button>
          <Button asChild variant="link" size="link-sm" className="self-start">
            <Link href="/cart">Edit cart</Link>
          </Button>
          <p className="text-xs tracking-wide text-muted">You can cancel your order until the shop confirms it.</p>
        </aside>
      </div>
      <Dialog open={confirming} onOpenChange={(open) => { if (!isPending) setConfirming(open); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogTitle className="font-serif text-3xl leading-tight text-primary">Confirm your order</DialogTitle>
          <DialogDescription className="mt-2 text-body">Please check everything below, then confirm to place your order.</DialogDescription>
          <ul className="mt-6 flex flex-col gap-4">
            {cart.lines.map((line) => (
              <li key={line.id} className="flex items-center gap-4 tracking-wide">
                <CartThumbnail url={line.imageUrl} size={64} />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5 leading-normal">
                  <p className="text-sm font-medium text-ink">{line.productName}</p>
                  <p className="text-xs text-muted">{line.sizeLabel} × {line.quantity}</p>
                </div>
                <p className="text-sm font-medium text-ink">{formatPeso(line.priceInCentavos * line.quantity)}</p>
              </li>
            ))}
          </ul>
          <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 border-t border-line pt-6 text-sm tracking-wide">
            <dt className="text-muted">{fulfillmentMethod === "delivery" ? "Delivery to" : "Pickup at"}</dt>
            <dd className="text-right text-ink">
              {fulfillmentMethod === "delivery" && selectedAddress
                ? formatAddressLine(selectedAddress)
                : "Antipolo store"}
            </dd>
            <dt className="text-muted">Payment</dt>
            <dd className="text-right text-ink">{PAYMENT_LABELS[paymentMethod]}</dd>
            <dt className="text-muted">Subtotal</dt>
            <dd className="text-right text-ink">{formatPeso(cart.subtotalInCentavos)}</dd>
            {discount > 0 ? (
              <>
                <dt className="text-muted">Senior/PWD {seniorPwdDiscount?.label}</dt>
                <dd className="text-right text-success">−{formatPeso(discount)}</dd>
              </>
            ) : null}
            <dt className="font-medium text-ink">Total</dt>
            <dd className="text-right font-serif text-[22px] leading-[1.3] text-primary">
              {formatPeso(total)}{fulfillmentMethod === "delivery" && !freeDelivery ? " + delivery" : ""}
            </dd>
          </dl>
          {fulfillmentMethod === "delivery" ? (
            <p className="mt-4 text-xs leading-normal tracking-wide text-body">{freeDelivery ? FREE_DELIVERY_CONFIRMATION_NOTICE : FEE_TO_FOLLOW_COPY}</p>
          ) : null}
          <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="pill-outline" size="pill-sm" disabled={isPending} onClick={() => setConfirming(false)}>
              Back to edit
            </Button>
            <Button type="button" variant="pill" size="pill-sm" disabled={isPending} onClick={submitOrder}>
              {isPending ? "Placing Order…" : "Confirm order"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

/** Where the Customer is in the buying journey; checkout is always step two. */
function CheckoutSteps() {
  const dot = "grid size-7 place-items-center rounded-full text-[13px] font-medium";
  return (
    <ol className="flex items-center gap-3 text-sm font-medium tracking-wide" aria-label="Checkout progress">
      <li className="flex items-center gap-2 text-ink">
        <span className={`${dot} bg-primary text-white`}><Check aria-hidden className="size-3.5" /></span>
        Cart
      </li>
      <li aria-hidden className="hidden h-px w-10 bg-line sm:block" />
      <li aria-current="step" className="flex items-center gap-2 text-ink">
        <span className={`${dot} bg-primary text-white`}>2</span>
        Details &amp; payment
      </li>
      <li aria-hidden className="hidden h-px w-10 bg-line sm:block" />
      <li className="hidden items-center gap-2 text-muted sm:flex">
        <span className={`${dot} bg-surface-container-low text-muted`}>3</span>
        Confirmation
      </li>
    </ol>
  );
}

function Panel({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-5 border border-line bg-white p-8 sm:p-10">
      <div className="flex flex-wrap items-center justify-between gap-x-[30px] gap-y-3">
        <h2 className="font-serif text-[22px] leading-[1.3] text-primary">{title}</h2>
        {action}
      </div>
      {children}
    </div>
  );
}

const optionClass = (checked: boolean) =>
  `flex cursor-pointer items-start gap-4 px-6 py-5 transition has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary ${
    checked ? "border-2 border-primary bg-lavender-soft" : "border border-line bg-white hover:border-primary"
  }`;

function RadioDot({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden
      className={`mt-px size-5 shrink-0 rounded-full bg-white ${checked ? "border-[6px] border-primary" : "border-[1.5px] border-line"}`}
    />
  );
}

function Choice({ checked, description, icon: Icon, label, name, onChange, value }: { checked: boolean; description: string; icon: typeof Store; label: string; name: string; onChange: () => void; value: string }) {
  return (
    <label className={optionClass(checked)}>
      <input checked={checked} className="sr-only" name={name} onChange={onChange} type="radio" value={value} />
      <RadioDot checked={checked} />
      <Icon aria-hidden className="size-[22px] shrink-0 text-ink" />
      <span className="flex min-w-0 flex-1 flex-col gap-1 leading-normal tracking-wide">
        <span className="text-sm font-medium text-ink">{label}</span>
        <span className="text-xs text-body">{description}</span>
      </span>
    </label>
  );
}

function DeliveryAddressChoice({ addresses, addressId, onAddressIdChange }: { addresses: CustomerAddress[]; addressId?: number; onAddressIdChange: (id: number) => void; }) {
  return <Panel title="2. Delivery details" action={<AddAddressDialog onAddressAdded={onAddressIdChange} />}>
    {addresses.length === 0 ? <p className="text-sm text-warning">Add an Address before placing a Delivery Order.</p> : <fieldset className="flex flex-col gap-4">
      <legend className="sr-only">Delivery Address</legend>
      {addresses.map((address) => <label className={optionClass(address.id === addressId)} key={address.id}>
        <input checked={address.id === addressId} className="sr-only" name="delivery-address" onChange={() => onAddressIdChange(address.id)} type="radio" value={address.id} />
        <RadioDot checked={address.id === addressId} />
        <MapPin aria-hidden className="size-[22px] shrink-0 text-ink" />
        <span className="flex min-w-0 flex-1 flex-col gap-1 leading-normal tracking-wide"><span className="text-sm font-medium text-ink">{address.label}{address.isDefault ? " · Default" : ""}</span><span className="text-xs text-body">{formatAddressLine(address)}</span></span>
      </label>)}
    </fieldset>}
  </Panel>;
}

function AddAddressDialog({ onAddressAdded }: { onAddressAdded: (id: number) => void; }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(addCheckoutAddress, initialAddressState);
  useEffect(() => { if (state.addressId) { onAddressAdded(state.addressId); router.refresh(); } }, [onAddressAdded, router, state.addressId]);
  const streetError = state.fieldErrors?.street?.[0];
  const postalError = state.fieldErrors?.postalCode?.[0];
  return <Dialog><DialogTrigger asChild><Button type="button" variant="link" size="link-sm"><Plus aria-hidden className="size-4" />Add an address</Button></DialogTrigger><DialogContent><DialogTitle className="font-serif text-3xl text-primary">Add an Address</DialogTitle><DialogDescription className="mt-2 text-on-surface-variant">Save a new Address and use it for this Delivery Order.</DialogDescription><form action={action} className="mt-6 grid gap-4 sm:grid-cols-2"><div className="sm:col-span-2"><Label htmlFor="checkout-label" required>Label</Label><select className="mt-1 h-11 w-full border border-input bg-white px-3" defaultValue="Home" id="checkout-label" name="label"><option>Home</option><option>Work</option><option>Other</option></select></div><div className="sm:col-span-2"><Label htmlFor="checkout-street" required>Street address</Label><Input aria-describedby={streetError ? "checkout-street-error" : undefined} aria-invalid={Boolean(streetError)} autoComplete="street-address" id="checkout-street" name="street" onInput={sanitizeStreetInput} required />{streetError ? <p className="mt-1 text-sm text-red-700" id="checkout-street-error" role="alert">{streetError}</p> : null}</div><PsgcAddressFields errors={state.fieldErrors ?? {}} /><div><Label htmlFor="postalCode-checkout" required>Postal code</Label><Input aria-describedby={postalError ? "postalCode-checkout-error" : undefined} aria-invalid={Boolean(postalError)} autoComplete="postal-code" id="postalCode-checkout" inputMode="numeric" maxLength={4} name="postalCode" onInput={sanitizePostalCodeInput} required />{postalError ? <p className="mt-1 text-sm text-red-700" id="postalCode-checkout-error" role="alert">{postalError}</p> : null}</div><Button disabled={pending} type="submit">{pending ? "Adding…" : "Add Address"}</Button></form></DialogContent></Dialog>;
}
