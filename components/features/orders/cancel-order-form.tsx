"use client";

import { useActionState } from "react";

import { cancelOrder, type OrderCancellationState } from "@/app/(site)/(protected)/profile/orders/actions";
import { Button } from "@/components/ui/button";

const initialState: OrderCancellationState = {};

/** Lets a Customer cancel an Order until staff dispatch it. */
export function CancelOrderForm({ orderId }: { orderId: number }) {
  const [state, action, pending] = useActionState(cancelOrder, initialState);

  return (
    <form action={action} className="mt-5 border-t border-outline-variant/60 pt-4">
      <input name="orderId" type="hidden" value={orderId} />
      <p className="text-sm text-on-surface-variant">You can cancel this Order until it is dispatched.</p>
      {state.message ? <p className="mt-2 text-sm text-red-700" role="alert">{state.message}</p> : null}
      {state.cancelled ? <p className="mt-2 text-sm font-semibold text-secondary" role="status">Order cancelled.</p> : null}
      {state.emailWarning ? <p className="mt-2 text-sm text-on-surface-variant" role="status">{state.emailWarning}</p> : null}
      <Button className="mt-3" disabled={pending} type="submit" variant="outline">
        {pending ? "Cancelling…" : "Cancel Order"}
      </Button>
    </form>
  );
}
