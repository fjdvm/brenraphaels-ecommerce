"use client";

import { ArrowRight, MessageCircle, Package, Store, Truck, Upload, User, Wallet, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState, type ReactNode } from "react";

import { createTicket, type CreateTicketState } from "@/app/(site)/(protected)/support/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { fieldClass, fieldLabelClass } from "@/components/ui/field-styles";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { ticketCategories, type TicketCategory } from "@/lib/support/tickets";

const initialState: CreateTicketState = {};

const categoryChips: Record<TicketCategory, { label: string; icon: ReactNode }> = {
  "Order Issue": { label: "Order issue", icon: <Package aria-hidden className="size-4" strokeWidth={1.5} /> },
  "Payment Issue": { label: "Payment", icon: <Wallet aria-hidden className="size-4" strokeWidth={1.5} /> },
  "Delivery Issue": { label: "Delivery & pickup", icon: <Truck aria-hidden className="size-4" strokeWidth={1.5} /> },
  "Product Question": { label: "Product", icon: <Store aria-hidden className="size-4" strokeWidth={1.5} /> },
  Account: { label: "Account", icon: <User aria-hidden className="size-4" strokeWidth={1.5} /> },
  Other: { label: "Other", icon: <MessageCircle aria-hidden className="size-4" strokeWidth={1.5} /> },
};

/** Lets a Customer open one Support Ticket, optionally linked to one of their Orders, then lands them in its conversation. */
export function OpenTicketForm({
  orders,
  defaultOrderId,
  defaultCategory,
  followUpOfId,
}: {
  orders: { id: number; label: string }[];
  defaultOrderId?: number;
  /** Pre-selected for a Follow-up Ticket; still editable. */
  defaultCategory?: TicketCategory;
  /** The Completed Ticket this one follows up. */
  followUpOfId?: number;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(createTicket, initialState);
  const [fileName, setFileName] = useState<string>();
  const formRef = useRef<HTMLFormElement>(null);
  const [summary, setSummary] = useState<{ subject: string; category: string; order: string }>();

  // The Customer reviews the Ticket before it is sent: the browser checks required fields first, then the dialog asks.
  function review() {
    const form = formRef.current;
    if (!form || !form.reportValidity()) return;
    const data = new FormData(form);
    const category = String(data.get("category") ?? "") as TicketCategory;
    const orderId = String(data.get("orderId") ?? "");
    setSummary({
      subject: String(data.get("subject") ?? "").trim(),
      category: categoryChips[category]?.label ?? category,
      order: orderId ? `Order #${orderId}` : "None",
    });
  }

  function send() {
    setSummary(undefined);
    formRef.current?.requestSubmit();
  }

  useEffect(() => {
    if (state.created && state.ticketId) router.push(`/support/${state.ticketId}`);
  }, [state.created, state.ticketId, router]);

  return (
    <form action={action} className="flex h-full flex-col gap-6 overflow-y-auto p-6 sm:p-[60px]" ref={formRef}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h2 className="font-serif text-4xl leading-[1.2] text-primary sm:text-[44px]">Open a ticket</h2>
          <p className="leading-[1.6] tracking-[0.35px] text-body">
            Tell us what happened — our team usually replies within the day (Mon–Sat).
          </p>
        </div>
        <Link
          aria-label="Close"
          className="flex size-10 shrink-0 items-center justify-center rounded-full border border-line text-ink transition-colors hover:bg-lavender-soft"
          href="/support"
        >
          <X aria-hidden className="size-[18px]" strokeWidth={1.5} />
        </Link>
      </div>

      {followUpOfId ? (
        <>
          <input name="followUpOfId" type="hidden" value={followUpOfId} />
          <p className="text-sm tracking-[0.35px] text-primary">Follow-up of Ticket #{followUpOfId}</p>
        </>
      ) : null}

      <Field error={state.fieldErrors?.subject?.[0]} id="ticket-subject" label="Subject" required>
        <Input
          aria-invalid={Boolean(state.fieldErrors?.subject)}
          className={fieldClass}
          id="ticket-subject"
          maxLength={160}
          name="subject"
          placeholder="e.g. Payment not reflecting"
          required
        />
      </Field>

      <fieldset className="flex flex-col gap-2">
        <legend className={`${fieldLabelClass} mb-2`}>
          Category<span aria-hidden className="ml-0.5 text-red-700">*</span>
        </legend>
        <div className="flex flex-wrap gap-2.5">
          {ticketCategories.map((category, index) => (
            <label className="cursor-pointer" key={category}>
              <input className="peer sr-only" defaultChecked={category === defaultCategory} name="category" required={index === 0} type="radio" value={category} />
              <span className="flex items-center gap-2 rounded-full border border-line bg-white px-[18px] py-2.5 text-sm font-medium tracking-[0.35px] text-ink transition-colors peer-checked:border-2 peer-checked:border-primary peer-checked:bg-lavender peer-checked:text-primary peer-focus-visible:ring-2 peer-focus-visible:ring-ring">
                {categoryChips[category].icon}
                {categoryChips[category].label}
              </span>
            </label>
          ))}
        </div>
        {state.fieldErrors?.category?.[0] ? <p className="text-sm text-red-700" role="alert">{state.fieldErrors.category[0]}</p> : null}
      </fieldset>

      <Field error={state.fieldErrors?.orderId?.[0]} id="ticket-order" label="Related order (optional)">
        <Select
          aria-invalid={Boolean(state.fieldErrors?.orderId)}
          className={fieldClass}
          defaultValue={defaultOrderId && orders.some((order) => order.id === defaultOrderId) ? String(defaultOrderId) : ""}
          id="ticket-order"
          key={defaultOrderId}
          name="orderId"
        >
          <option value="">No related order</option>
          {orders.map((order) => <option key={order.id} value={order.id}>{order.label}</option>)}
        </Select>
      </Field>

      <Field error={state.fieldErrors?.body?.[0]} id="ticket-message" label="Message" required>
        <textarea
          aria-invalid={Boolean(state.fieldErrors?.body)}
          className="min-h-32 w-full border border-line bg-white px-4 py-3.5 text-sm tracking-[0.35px] outline-none placeholder:text-muted focus:ring-2 focus:ring-ring"
          id="ticket-message"
          maxLength={2_000}
          name="body"
          placeholder="Describe the issue so we can help faster…"
          required
        />
      </Field>

      <div className="relative flex items-center gap-4 border border-dashed border-primary bg-lavender-soft px-6 py-6 focus-within:ring-2 focus-within:ring-ring">
        <Upload aria-hidden className="size-5 shrink-0 text-primary" strokeWidth={1.5} />
        <div className="flex min-w-0 flex-col gap-0.5">
          <Label className="text-sm font-medium tracking-[0.35px] text-primary" htmlFor="ticket-attachment">
            {fileName ?? "Drop an image or browse"}
          </Label>
          <p className="text-xs tracking-[0.35px] text-muted">
            Optional · JPEG or PNG up to 5 MB — e.g. a GCash receipt or a photo of the product
          </p>
        </div>
        <input
          accept="image/jpeg,image/png"
          aria-invalid={Boolean(state.fieldErrors?.attachment)}
          className="absolute inset-0 size-full cursor-pointer opacity-0"
          id="ticket-attachment"
          name="attachment"
          onChange={(event) => setFileName(event.target.files?.[0]?.name)}
          type="file"
        />
      </div>
      {state.fieldErrors?.attachment?.[0] ? <p className="-mt-3 text-sm text-red-700" role="alert">{state.fieldErrors.attachment[0]}</p> : null}

      {state.message ? <p className="text-sm text-red-700" role="alert">{state.message}</p> : null}
      <div className="flex items-center justify-end gap-3">
        <Button asChild size="link-sm" variant="link">
          <Link className="px-3 text-lg font-normal" href="/support">Cancel</Link>
        </Button>
        <Button disabled={pending || state.created} onClick={review} size="pill-lg" type="button" variant="pill">
          {pending || state.created ? "Opening…" : "Open ticket"}
          <ArrowRight aria-hidden className="size-5" />
        </Button>
      </div>

      <Dialog onOpenChange={(open) => !open && setSummary(undefined)} open={Boolean(summary)}>
        <DialogContent className="max-w-md p-6 sm:p-8">
          <DialogTitle className="font-serif text-2xl leading-tight text-primary">Send this ticket?</DialogTitle>
          <DialogDescription className="mt-2 text-sm text-muted">We&apos;ll reply within the day (Mon–Sat).</DialogDescription>
          <dl className="mt-6 flex flex-col gap-3 text-sm text-ink">
            {summary
              ? [["Subject", summary.subject], ["Category", summary.category], ["Related order", summary.order]].map(([term, value]) => (
                  <div className="flex justify-between gap-4" key={term}>
                    <dt>{term}</dt>
                    <dd className="text-right">{value}</dd>
                  </div>
                ))
              : null}
          </dl>
          <div className="mt-6 flex justify-end gap-3">
            <Button onClick={() => setSummary(undefined)} size="pill-sm" type="button" variant="pill-outline">Go back</Button>
            <Button onClick={send} size="pill-sm" type="button" variant="pill">Send ticket</Button>
          </div>
        </DialogContent>
      </Dialog>
    </form>
  );
}

function Field({
  id,
  label,
  required,
  error,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label className={fieldLabelClass} htmlFor={id} required={required}>{label}</Label>
      {children}
      {error ? <p className="text-sm text-red-700" role="alert">{error}</p> : null}
    </div>
  );
}
