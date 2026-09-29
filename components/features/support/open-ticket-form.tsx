"use client";

import { useActionState } from "react";

import { createTicket, type CreateTicketState } from "@/app/(site)/(protected)/support/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { ticketCategories } from "@/lib/support/tickets";

const initialState: CreateTicketState = {};

/** Lets a Customer open one Support Ticket, optionally linked to one of their Orders. */
export function OpenTicketForm({ orders }: { orders: { id: number }[] }) {
  const [state, action, pending] = useActionState(createTicket, initialState);
  if (state.created) {
    return <p className="rounded-md bg-secondary-container p-4 text-sm font-semibold text-secondary" role="status">Your Ticket is open.</p>;
  }

  return (
    <form action={action} className="rounded-md border border-outline-variant/60 bg-surface-card p-5">
      <h2 className="font-serif text-2xl text-primary">Open a Ticket</h2>
      <p className="mt-1 text-sm text-on-surface-variant">Tell us how we can help.</p>
      <div className="mt-5 grid gap-4">
        <div>
          <Label htmlFor="ticket-subject" required>Subject</Label>
          <Input aria-invalid={Boolean(state.fieldErrors?.subject)} id="ticket-subject" maxLength={160} name="subject" required />
          <FieldError message={state.fieldErrors?.subject?.[0]} />
        </div>
        <div>
          <Label htmlFor="ticket-category" required>Category</Label>
          <Select aria-invalid={Boolean(state.fieldErrors?.category)} defaultValue="" id="ticket-category" name="category" required>
            <option disabled value="">Choose a category</option>
            {ticketCategories.map((category) => <option key={category} value={category}>{category}</option>)}
          </Select>
          <FieldError message={state.fieldErrors?.category?.[0]} />
        </div>
        <div>
          <Label htmlFor="ticket-order">Related Order <span className="font-normal">(optional)</span></Label>
          <Select aria-invalid={Boolean(state.fieldErrors?.orderId)} defaultValue="" id="ticket-order" name="orderId">
            <option value="">No related Order</option>
            {orders.map((order) => <option key={order.id} value={order.id}>Order #{order.id}</option>)}
          </Select>
          <FieldError message={state.fieldErrors?.orderId?.[0]} />
        </div>
        <div>
          <Label htmlFor="ticket-message" required>Message</Label>
          <textarea aria-invalid={Boolean(state.fieldErrors?.body)} className="mt-1 min-h-32 w-full border border-input bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-ring" id="ticket-message" maxLength={2_000} name="body" required />
          <FieldError message={state.fieldErrors?.body?.[0]} />
        </div>
        <div>
          <Label htmlFor="ticket-attachment">Image <span className="font-normal">(optional, JPEG or PNG up to 5 MB)</span></Label>
          <Input accept="image/jpeg,image/png" aria-invalid={Boolean(state.fieldErrors?.attachment)} id="ticket-attachment" name="attachment" type="file" />
          <FieldError message={state.fieldErrors?.attachment?.[0]} />
        </div>
      </div>
      {state.message ? <p className="mt-4 text-sm text-red-700" role="alert">{state.message}</p> : null}
      <Button className="mt-5" disabled={pending} type="submit">{pending ? "Opening…" : "Open Ticket"}</Button>
    </form>
  );
}

function FieldError({ message }: { message?: string }) {
  return message ? <p className="mt-1 text-sm text-red-700" role="alert">{message}</p> : null;
}
